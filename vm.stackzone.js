"use strict";
/*
 * Stack zone: flat activation frames with lazy context reification.
 * See perf/stack-zone-design.md for the full design and the v1 marriage
 * protocol (snapshot + sync-at-send + flush-on-write).
 *
 * Enabled per interpreter instance via options.stackZone. When enabled, the
 * interpreter NEVER executes on heap contexts: sends push flat frames into
 * growable zone pages (one page per process fragment), and heap Context
 * objects exist only as dormant snapshots. makeBaseFrame (context -> frame)
 * and flush (frame -> context) are the only transitions.
 *
 * Frame layout (slot indices relative to fp, stack grows up):
 *   receiver+args pushed by caller end at fp-1 (rcvr at fp-1-numArgs)
 *   fp+0 savedFp   caller's fp in same page, -1 if base frame of page
 *   fp+1 savedPc   caller's resumption pc (raw zero-based int, no encoding)
 *   fp+2 method    CompiledMethod
 *   fp+3 flags     numArgs (16 bits) | hasContext<<17
 *   fp+4 context   married Context or null
 *   fp+5 closure   BlockClosure/FullBlockClosure or nilObj
 *   fp+6 receiver
 *   fp+7 temps (args copied here first, then locals), then operand stack
 */

Object.extend(Squeak, {
    Frame_savedFp: 0,
    Frame_savedPc: 1,
    Frame_method: 2,
    Frame_flags: 3,
    Frame_context: 4,
    Frame_closure: 5,
    Frame_receiver: 6,
    Frame_firstTemp: 7,
    Frame_hasContext: 1 << 17,
});

Object.extend(Squeak.Interpreter.prototype,
'stack zone', {
    enableStackZone: function() {
        this.useStackZone = true;
        this.zonePages = [];
        this.zonePage = null;
        this.fp = -1;
        // no hay getter mágico: activeContext queda null y los lectores legítimos
        // usan activeContextObj() (un defineProperty con getter sobre la instancia
        // degrada TODOS los accesos a propiedades del vm — 10x+ en el camino caliente)
        this.activeContext = null;
        // cache para gatear los probes .frame: solo instancias de MethodContext
        // pueden estar casadas; comparar la clase primero evita LoadICs
        // megamórficos sobre receivers arbitrarios (medido: 24% del tiempo)
        this.contextClass_ = this.specialObjects[Squeak.splOb_ClassMethodContext];
        this.smallIntClass_ = this.specialObjects[Squeak.splOb_ClassInteger];
        this.LEAF_DEOPT_ = Squeak.LEAF_DEOPT;
        var vm = this;
        // rebind execution methods to the frames variants
        this.send = this.sendZ;
        this.tryPrimitive = this.tryPrimitiveZ;
        this.activeContextObj = this.activeContextObjZ;
        this.sendSuperDirected = this.sendSuperDirectedZ;
        this.executeNewMethod = this.executeNewMethodZ;
        this.doReturn = this.doReturnZ;
        this.doBlockReturn = this.doBlockReturnZ;
        this.exportThisContext = this.exportThisContextZ;
        this.newActiveContext = this.newActiveContextZ;
        this.loadInitialContext = this.loadInitialContextZ;
        this.storeContextRegisters = this.storeContextRegistersZ;
        this.fetchContextRegisters = this.fetchContextRegistersZ;
        this.allocateOrRecycleContext = this.allocateOrRecycleContextZ;
        // primHandler: closure activation pushes frames; reflective prims sync/flush
        var ph = this.primHandler;
        ph.activateNewClosureMethod = ph.activateNewClosureMethodZ;
        ph.activateNewFullClosure = ph.activateNewFullClosureZ;
        var origObjectAt = ph.objectAt;
        ph.objectAt = function(cameFromBytecode, convertChars, includeInstVars) {
            var rcvr = this.stackNonInteger(1);
            if (rcvr.sqClass === vm.contextClass_ && rcvr.frame != null) vm.syncMarriedContext(rcvr);
            return origObjectAt.call(this, cameFromBytecode, convertChars, includeInstVars);
        };
        var origObjectAtPut = ph.objectAtPut;
        ph.objectAtPut = function(cameFromBytecode, convertChars, includeInstVars) {
            var rcvr = this.stackNonInteger(2);
            if (rcvr.sqClass === vm.contextClass_ && rcvr.frame != null) vm.flushAllAndContinue();
            return origObjectAtPut.call(this, cameFromBytecode, convertChars, includeInstVars);
        };
        var origStoreStackp = ph.primitiveStoreStackp;
        ph.primitiveStoreStackp = function(argCount) {
            var ctxt = this.stackNonInteger(1);
            if (ctxt.sqClass === vm.contextClass_ && ctxt.frame != null) vm.flushAllAndContinue();
            return origStoreStackp.call(this, argCount);
        };
        var origArrayBecome = ph.primitiveArrayBecome;
        ph.primitiveArrayBecome = function(argCount, doBothWays, copyHash) {
            // frames hold raw refs the become machinery doesn't know about:
            // flush everything to real contexts first, then become sees it all
            vm.flushAllAndContinue();
            return origArrayBecome.call(this, argCount, doBothWays, copyHash);
        };
        var origSnapshot = ph.primitiveSnapshot;
        ph.primitiveSnapshot = function(argCount) {
            vm.flushAllAndContinue();
            return origSnapshot.call(this, argCount);
        };
        // logical GC: live page slots are roots
        this.image.gcRoots = function() {
            return [this.specialObjectsArray].concat(vm.frameGCRoots());
        };
    },
    allocPage: function() {
        for (var i = 0; i < this.zonePages.length; i++)
            if (!this.zonePages[i].live) {
                var page = this.zonePages[i];
                page.slots.length = 0;
                page.live = true;
                page.baseCallerCtx = null;
                if (this.pageStats) this.pageStats.reused++;
                return page;
            }
        if (this.zonePages.length >= 32) {
            // sin muertas y con muchas vivas: páginas de procesos terminados
            // quedan vivas-inalcanzables (el terminate corta cadenas a nivel
            // context). Flushear una suspendida es siempre correcto (su resume
            // re-infla via makeBaseFrame) y la vuelve reutilizable.
            for (var i = 0; i < this.zonePages.length; i++) {
                var victim = this.zonePages[i];
                if (victim.live && victim !== this.zonePage) {
                    this.flushPageAndContinue(victim);
                    victim.slots.length = 0;
                    victim.live = true;
                    victim.baseCallerCtx = null;
                    if (this.pageStats) this.pageStats.evicted = (this.pageStats.evicted || 0) + 1;
                    return victim;
                }
            }
        }
        var fresh = { slots: [], fp: -1, sp: -1, pc: -1, live: true, baseCallerCtx: null };
        this.zonePages.push(fresh);
        if (this.pageStats) this.pageStats.fresh++;
        return fresh;
    },
    activatePage: function(page) {
        this.zonePage = page;
        var slots = page.slots;
        this.stack = slots;
        this.temps = slots;
        this.fp = page.fp;
        this.sp = page.sp;
        this.pc = page.pc;
        this.method = slots[this.fp + Squeak.Frame_method];
        this.receiver = slots[this.fp + Squeak.Frame_receiver];
        this.tempOffset = this.fp + Squeak.Frame_firstTemp;
        this.homeContext = null; // not meaningful in frames mode
    },
    saveActivePage: function() {
        var page = this.zonePage;
        if (!page) return;
        page.fp = this.fp;
        page.sp = this.sp;
        page.pc = this.pc;
    },
    frameGCRoots: function() {
        this.saveActivePage();
        var roots = [];
        for (var i = 0; i < this.zonePages.length; i++) {
            var page = this.zonePages[i];
            if (!page.live) continue;
            var slots = page.slots;
            for (var j = 0; j <= page.sp; j++) {
                var v = slots[j];
                if (typeof v === "object" && v !== null) roots.push(v);
            }
        }
        return roots;
    },
},
'frames: marriage', {
    marryFrame: function(page, fp) {
        var slots = page.slots;
        var ctx = slots[fp + Squeak.Frame_context];
        if (ctx) return ctx;
        var method = slots[fp + Squeak.Frame_method];
        ctx = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMethodContext],
            method.methodNeedsLargeFrame() ? Squeak.Context_largeFrameSize : Squeak.Context_smallFrameSize);
        // shallow snapshot: immutable fields real, mutable ones minimal-but-sane
        // (syncPage fills pc/stackp/sender/temps before Smalltalk can look)
        ctx.pointers[Squeak.Context_sender] = this.nilObj;
        ctx.pointers[Squeak.Context_instructionPointer] = this.nilObj;
        ctx.pointers[Squeak.Context_stackPointer] = 0;
        ctx.pointers[Squeak.Context_method] = method;
        ctx.pointers[Squeak.Context_closure] = slots[fp + Squeak.Frame_closure];
        ctx.pointers[Squeak.Context_receiver] = slots[fp + Squeak.Frame_receiver];
        ctx.frame = { page: page, fp: fp };
        ctx.dirty = true;
        slots[fp + Squeak.Frame_context] = ctx;
        slots[fp + Squeak.Frame_flags] |= Squeak.Frame_hasContext;
        this.nMarriedContexts = (this.nMarriedContexts || 0) + 1;
        return ctx;
    },
    syncMarriedContext: function(ctx) {
        // refresca el snapshot de UN context casado. El tope de página es O(1)
        // de ubicar; para frames profundos se busca el callee desde el tope.
        // El caller se casa shallow (sin fill): se sincroniza cuando se observe.
        var f = ctx.frame;
        if (f == null) return;
        var page = f.page, fp = f.fp;
        this.saveActivePage();
        var slots = page.slots;
        var pc, sp;
        if (fp === page.fp) {
            pc = page.pc;
            sp = page.sp;
        } else {
            // buscar el callee: el frame cuyo savedFp === fp
            var t = page.fp;
            while (t >= 0 && slots[t + Squeak.Frame_savedFp] !== fp)
                t = slots[t + Squeak.Frame_savedFp];
            if (t < 0) throw Error("stack zone: married frame not on its page chain");
            pc = slots[t + Squeak.Frame_savedPc];
            sp = t - 2 - (slots[t + Squeak.Frame_flags] & 0xFFFF);
        }
        var p = ctx.pointers;
        var savedFp = slots[fp + Squeak.Frame_savedFp];
        if (savedFp >= 0 && page.slots[savedFp + Squeak.Frame_context] == null)
            this.nMarrySenderFill = (this.nMarrySenderFill || 0) + 1;
        p[Squeak.Context_sender] = savedFp >= 0 ? this.marryFrame(page, savedFp)
            : (page.baseCallerCtx || this.nilObj);
        p[Squeak.Context_instructionPointer] =
            this.encodeSqueakPC(pc, slots[fp + Squeak.Frame_method]);
        var stackp = sp - fp - Squeak.Frame_firstTemp + 1;
        p[Squeak.Context_stackPointer] = stackp;
        for (var i = 0; i < stackp; i++)
            p[Squeak.Context_tempFrameStart + i] = slots[fp + Squeak.Frame_firstTemp + i];
        ctx.dirty = true;
    },
    syncPage: function(page) {
        // refresh the snapshots of all married frames in a page (top to base);
        // marries callers shallowly to fill sender fields, so a full walk from
        // Smalltalk deepens the married chain one syncPage at a time
        this.saveActivePage();
        var slots = page.slots;
        var fp = page.fp, pc = page.pc, sp = page.sp;
        while (fp >= 0) {
            var ctx = slots[fp + Squeak.Frame_context];
            var savedFp = slots[fp + Squeak.Frame_savedFp];
            if (ctx) {
                var p = ctx.pointers;
                p[Squeak.Context_sender] = savedFp >= 0 ? this.marryFrame(page, savedFp)
                    : (page.baseCallerCtx || this.nilObj);
                p[Squeak.Context_instructionPointer] =
                    this.encodeSqueakPC(pc, slots[fp + Squeak.Frame_method]);
                var stackp = sp - fp - Squeak.Frame_firstTemp + 1;
                p[Squeak.Context_stackPointer] = stackp;
                for (var i = 0; i < stackp; i++)
                    p[Squeak.Context_tempFrameStart + i] = slots[fp + Squeak.Frame_firstTemp + i];
                ctx.dirty = true;
            }
            // move down: caller's pc/sp derive from this frame
            pc = slots[fp + Squeak.Frame_savedPc];
            sp = fp - 2 - (slots[fp + Squeak.Frame_flags] & 0xFFFF);
            fp = savedFp;
        }
    },
    storeToMarriedContext: function(ctx, index, value) {
        if (this.smcStats) this.smcStats[index] = (this.smcStats[index] || 0) + 1;
        // Smalltalk escribe un campo de un context con frame vivo (terminate,
        // unwind, debugger): serializar SU página a contexts reales, seguir en
        // un base frame fresco si era la activa, y escribir sobre el context real
        this.flushPageAndContinue(ctx.frame.page);
        ctx.pointers[index] = value;
        ctx.dirty = true;
        if (ctx.frame != null) {
            // la escritura cayó sobre el context re-casado del frame base activo:
            // mantener la vista del frame consistente
            var page = ctx.frame.page;
            if (index === Squeak.Context_sender) page.baseCallerCtx = value;
            else if (index === Squeak.Context_instructionPointer && typeof value === "number")
                this.pc = this.decodeSqueakPC(value, page.slots[ctx.frame.fp + Squeak.Frame_method]);
            else this.warnOnce("stack zone: unusual store to active context field " + index);
        }
    },
    widowFrameContext: function(ctx) {
        ctx.pointers[Squeak.Context_sender] = this.nilObj;
        ctx.pointers[Squeak.Context_instructionPointer] = this.nilObj;
        ctx.frame = null;
        ctx.dirty = true;
    },
    flushPageAndContinue: function(page) {
        // serializar SOLO una página a contexts reales (stores a contexts casados
        // suelen ser cirugía de cadena en una página; flushear todas — Dialogo
        // hacía 23k flushes totales por 10M sends — era el martillo grande)
        this.nFlushPage = (this.nFlushPage || 0) + 1;
        this.saveActivePage();
        var isActive = page === this.zonePage;
        if (this.pageStats) { this.pageStats.flushActive += isActive ? 1 : 0; this.pageStats.flushSusp += isActive ? 0 : 1; if (!page.live) this.pageStats.flushDead++; }
        var top = isActive ? this.marryFrame(page, this.fp) : null;
        if (!isActive && page.fp >= 0) this.marryFrame(page, page.fp);
        for (var fp = page.fp; fp >= 0; fp = page.slots[fp + Squeak.Frame_savedFp])
            this.marryFrame(page, fp);
        this.syncPage(page);
        for (var fp = page.fp; fp >= 0; fp = page.slots[fp + Squeak.Frame_savedFp]) {
            var ctx = page.slots[fp + Squeak.Frame_context];
            if (ctx) ctx.frame = null;
        }
        page.live = false;
        if (isActive) {
            this.zonePage = null;
            this.makeBaseFrameZ(top);
        }
    },
    flushAllAndContinue: function() {
        // serialize every live frame to its (married) context, kill all pages,
        // and continue execution on a fresh base frame inflated from the top
        this.nFlushAll = (this.nFlushAll || 0) + 1;
        this.saveActivePage();
        var top = this.marryFrame(this.zonePage, this.fp);
        for (var i = 0; i < this.zonePages.length; i++) {
            var page = this.zonePages[i];
            if (!page.live) continue;
            // marry every frame so syncPage serializes all of them
            for (var fp = page.fp; fp >= 0; fp = page.slots[fp + Squeak.Frame_savedFp])
                this.marryFrame(page, fp);
            this.syncPage(page);
            for (var fp = page.fp; fp >= 0; fp = page.slots[fp + Squeak.Frame_savedFp]) {
                var ctx = page.slots[fp + Squeak.Frame_context];
                if (ctx) ctx.frame = null;
            }
            page.live = false;
        }
        this.zonePage = null;
        this.makeBaseFrameZ(top);
    },
    makeBaseFrameZ: function(ctx) {
        // inflate a dormant, resumable context into a fresh page's base frame
        var methodField = ctx.pointers[Squeak.Context_method];
        if (this.isSmallInt(methodField))
            throw Error("stack zone: pre-closure BlockContexts not supported");
        if (ctx.sqClass !== this.contextClass_)
            // los gates de sync/write-through comparan contra ClassMethodContext;
            // una subclase casada los evadiría silenciosamente
            throw Error("stack zone: cannot inflate a " + ctx.sqClass.className());
        var page = this.allocPage();
        var slots = page.slots;
        var closure = ctx.pointers[Squeak.Context_closure];
        var stackp = ctx.pointers[Squeak.Context_stackPointer];
        var numArgs = closure && !closure.isNil
            ? closure.pointers[Squeak.Closure_numArgs]
            : methodField.methodNumArgs();
        slots[Squeak.Frame_savedFp] = -1;
        slots[Squeak.Frame_savedPc] = 0;
        slots[Squeak.Frame_method] = methodField;
        slots[Squeak.Frame_flags] = numArgs | Squeak.Frame_hasContext;
        slots[Squeak.Frame_context] = ctx;
        slots[Squeak.Frame_closure] = closure;
        slots[Squeak.Frame_receiver] = ctx.pointers[Squeak.Context_receiver];
        for (var i = 0; i < stackp; i++)
            slots[Squeak.Frame_firstTemp + i] = ctx.pointers[Squeak.Context_tempFrameStart + i];
        page.baseCallerCtx = ctx.pointers[Squeak.Context_sender];
        page.fp = 0;
        page.sp = Squeak.Frame_firstTemp + stackp - 1;
        page.pc = this.decodeSqueakPC(ctx.pointers[Squeak.Context_instructionPointer], methodField);
        ctx.frame = { page: page, fp: 0 };
        ctx.dirty = true;
        this.activatePage(page);
    },
},
'frames: execution', {
    loadInitialContextZ: function() {
        var schedAssn = this.specialObjects[Squeak.splOb_SchedulerAssociation];
        var sched = schedAssn.pointers[Squeak.Assn_value];
        var proc = sched.pointers[Squeak.ProcSched_activeProcess];
        this.makeBaseFrameZ(proc.pointers[Squeak.Proc_suspendedContext]);
        this.reclaimableContextCount = 0;
    },
    sendZ: function(selector, argCount, doSuper) {
        var newRcvr = this.stack[this.sp - argCount];
        var lookupClass;
        if (doSuper) {
            lookupClass = this.method.methodClassForSuper();
            lookupClass = lookupClass.superclass();
        } else {
            lookupClass = this.getClass(newRcvr);
        }
        // married-context receivers: refresh their snapshot before Smalltalk looks
        // (class-identity gate first: no property probe on ordinary receivers)
        if (lookupClass === this.contextClass_ && newRcvr.frame != null)
            this.syncMarriedContext(newRcvr);
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        if (entry.primIndex) {
            this.verifyAtSelector = selector;
            this.verifyAtClass = lookupClass;
        }
        this.executeNewMethod(newRcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
    },
    sendSuperDirectedZ: function(selector, argCount) {
        var lookupClass = this.pop().superclass();
        var newRcvr = this.stack[this.sp - argCount];
        if (typeof newRcvr === "object" && newRcvr !== null
            && newRcvr.sqClass === this.contextClass_ && newRcvr.frame != null)
            this.syncMarriedContext(newRcvr);
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        if (entry.primIndex) {
            this.verifyAtSelector = selector;
            this.verifyAtClass = lookupClass;
        }
        this.executeNewMethod(newRcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
    },
    executeNewMethodZ: function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
        this.sendCount++;
        if (newMethod === this.breakOnMethod)
            this.breakNow("executing method " + this.printMethod(newMethod, optClass, optSel));
        if (this.logSends) {
            var args = this.stack.slice(this.sp + 1 - argumentCount, this.sp + 1);
            console.log(this.sendCount + ' ' + this.printMethod(newMethod, optClass, optSel, args));
        }
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
        if (primitiveIndex > 0)
            if (this.tryPrimitive(primitiveIndex, argumentCount, newMethod))
                return;  //Primitive succeeded -- end of story
        var slots = this.zonePage.slots;
        var nfp = this.sp + 1;
        slots[nfp + Squeak.Frame_savedFp] = this.fp;
        slots[nfp + Squeak.Frame_savedPc] = this.pc;
        slots[nfp + Squeak.Frame_method] = newMethod;
        slots[nfp + Squeak.Frame_flags] = argumentCount;
        slots[nfp + Squeak.Frame_context] = null;
        slots[nfp + Squeak.Frame_closure] = this.nilObj;
        slots[nfp + Squeak.Frame_receiver] = newRcvr;
        var tempCount = newMethod.methodTempCount();
        var base = nfp + Squeak.Frame_firstTemp;
        for (var i = 0; i < argumentCount; i++)
            slots[base + i] = slots[nfp - argumentCount + i];
        for (var i = argumentCount; i < tempCount; i++)
            slots[base + i] = this.nilObj;
        this.fp = nfp;
        this.sp = base + tempCount - 1;
        this.pc = 0;
        this.method = newMethod;
        this.receiver = newRcvr;
        this.tempOffset = base;
        if (!newMethod.compiled) this.compileIfPossible(newMethod, optClass, optSel);
        var myPage = this.zonePage;
        // check for process switch on full method activation
        if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
        // direct call: run the callee as a plain JS call instead of returning to
        // the trampoline. The JS stack never holds suspended state (every level
        // returns as soon as its Smalltalk continuation leaves its frame, via the
        // activation checks), so a process switch simply unwinds the whole chain
        // one compare+return per level. Depth-capped for the JS stack limit.
        if (newMethod.compiled && this.jsDepth < 512
            && this.fp === nfp && this.zonePage === myPage
            && this.breakOutOfInterpreter === false) {
            this.jsDepth++;
            newMethod.compiled(this);
            this.jsDepth--;
        }
    },
    doBlockReturnZ: function(returnValue) {
        // return from a block activation to its caller (never non-local)
        var slots = this.zonePage.slots;
        var fp = this.fp;
        var ctx = slots[fp + Squeak.Frame_context];
        if (ctx) this.widowFrameContext(ctx);
        var savedFp = slots[fp + Squeak.Frame_savedFp];
        var numArgs = slots[fp + Squeak.Frame_flags] & 0xFFFF;
        if (savedFp >= 0) {
            var retSlot = fp - 1 - numArgs;
            slots[retSlot] = returnValue;
            this.sp = retSlot;
            this.pc = slots[fp + Squeak.Frame_savedPc];
            this.fp = savedFp;
            this.method = slots[savedFp + Squeak.Frame_method];
            this.receiver = slots[savedFp + Squeak.Frame_receiver];
            this.tempOffset = savedFp + Squeak.Frame_firstTemp;
        } else {
            this.returnFromBaseFrame(returnValue);
        }
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
    },
    doReturnZ: function(returnValue) {
        var page = this.zonePage;
        var slots = page.slots;
        // 1. find home of the active frame (walk closure chain)
        var homePage = page, homeFp = this.fp, homeCtx = null;
        if (this.hasClosures) {
            while (true) {
                var closure = homeCtx ? homeCtx.pointers[Squeak.Context_closure]
                    : homePage.slots[homeFp + Squeak.Frame_closure];
                if (closure.isNil) break;
                var outer = closure.pointers[Squeak.Closure_outerContext];
                if (outer.frame != null) {
                    homePage = outer.frame.page; homeFp = outer.frame.fp; homeCtx = null;
                } else {
                    homeCtx = outer;
                }
            }
        }
        // 2. target = sender of home
        var targetPage = null, targetFp = -1, targetCtx = null;
        if (homeCtx) {
            targetCtx = homeCtx.pointers[Squeak.Context_sender];
        } else {
            var sfp = homePage.slots[homeFp + Squeak.Frame_savedFp];
            if (sfp >= 0) { targetPage = homePage; targetFp = sfp; }
            else targetCtx = homePage.baseCallerCtx || this.nilObj;
        }
        if (targetCtx) {
            if (targetCtx.frame != null) {
                targetPage = targetCtx.frame.page; targetFp = targetCtx.frame.fp; targetCtx = null;
            } else if (targetCtx.isNil || targetCtx.pointers[Squeak.Context_instructionPointer].isNil) {
                return this.cannotReturn(returnValue);
            }
        }
        // 3. unwind scan from caller-of-active down to target
        var sPage = page, sFp = slots[this.fp + Squeak.Frame_savedFp], sCtx = null;
        if (sFp < 0) { sCtx = page.baseCallerCtx || this.nilObj; sPage = null; }
        while (true) {
            if (sCtx === null) {
                if (sPage === targetPage && sFp === targetFp) break;
                var m = sPage.slots[sFp + Squeak.Frame_method];
                if (m.methodPrimitiveIndex() == 198)
                    return this.aboutToReturnThrough(returnValue, this.marryFrame(sPage, sFp));
                var nextFp = sPage.slots[sFp + Squeak.Frame_savedFp];
                if (nextFp >= 0) { sFp = nextFp; }
                else { sCtx = sPage.baseCallerCtx || this.nilObj; sPage = null; }
            } else {
                if (targetCtx !== null && sCtx === targetCtx) break;
                if (sCtx.isNil) return this.cannotReturn(returnValue);
                if (sCtx.frame != null) {
                    sPage = sCtx.frame.page; sFp = sCtx.frame.fp; sCtx = null;
                    if (sPage === targetPage && sFp === targetFp) break;
                    continue;
                }
                if (this.isUnwindMarked(sCtx))
                    return this.aboutToReturnThrough(returnValue, sCtx);
                sCtx = sCtx.pointers[Squeak.Context_sender];
            }
        }
        // 4. pop frames from active down to target, widowing married ones
        var pPage = page, pFp = this.fp;
        while (true) {
            var fslots = pPage.slots;
            var mCtx = fslots[pFp + Squeak.Frame_context];
            if (mCtx) this.widowFrameContext(mCtx);
            var lastPc = fslots[pFp + Squeak.Frame_savedPc];
            var lastNumArgs = fslots[pFp + Squeak.Frame_flags] & 0xFFFF;
            var downFp = fslots[pFp + Squeak.Frame_savedFp];
            if (downFp >= 0) {
                var retSlot = pFp - 1 - lastNumArgs;
                pFp = downFp;
                if (pPage === targetPage && pFp === targetFp) {
                    if (pPage !== this.zonePage) {
                        this.zonePage = pPage;
                        this.stack = pPage.slots;
                        this.temps = pPage.slots;
                    }
                    this.fp = pFp;
                    this.sp = retSlot;
                    pPage.slots[retSlot] = returnValue;
                    this.pc = lastPc;
                    this.method = pPage.slots[pFp + Squeak.Frame_method];
                    this.receiver = pPage.slots[pFp + Squeak.Frame_receiver];
                    this.tempOffset = pFp + Squeak.Frame_firstTemp;
                    break;
                }
            } else {
                // popped through the page's base frame: page dies
                pPage.live = false;
                var cctx = pPage.baseCallerCtx || this.nilObj;
                if (cctx.frame != null) {
                    pPage = cctx.frame.page;
                    pFp = cctx.frame.fp;
                    if (pPage === targetPage && pFp === targetFp) {
                        // landing on the (suspended) top frame of another page
                        this.activatePage(pPage);
                        this.push(returnValue);
                        break;
                    }
                } else {
                    // dormant context: scan guaranteed it's the target
                    this.zonePage = null;
                    this.makeBaseFrameZ(cctx);
                    this.push(returnValue);
                    break;
                }
            }
        }
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
    },
    returnFromBaseFrame: function(returnValue) {
        // active frame is a base frame; return to its caller context
        var page = this.zonePage;
        page.live = false;
        var cctx = page.baseCallerCtx || this.nilObj;
        var ctx = page.slots[this.fp + Squeak.Frame_context];
        if (ctx) this.widowFrameContext(ctx);
        if (cctx.frame != null) {
            this.activatePage(cctx.frame.page);
            this.push(returnValue);
        } else {
            if (cctx.isNil || cctx.pointers[Squeak.Context_instructionPointer].isNil)
                return this.cannotReturn(returnValue);
            this.zonePage = null;
            this.makeBaseFrameZ(cctx);
            this.push(returnValue);
        }
    },
    exportThisContextZ: function() {
        this.nMarryThisCtx = (this.nMarryThisCtx || 0) + 1;
        var ctx = this.marryFrame(this.zonePage, this.fp);
        this.syncMarriedContext(ctx); // solo el tope: O(frame), sin cascada
        this.reclaimableContextCount = 0;
        return ctx;
    },
    newActiveContextZ: function(newContext) {
        // process switch (transferTo) or explicit context activation
        this.saveActivePage();
        if (newContext.frame != null) {
            this.activatePage(newContext.frame.page);
        } else {
            this.makeBaseFrameZ(newContext);
        }
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
    },
    storeContextRegistersZ: function() {
        throw Error("stack zone: storeContextRegisters should not be called");
    },
    fetchContextRegistersZ: function(ctxt) {
        throw Error("stack zone: fetchContextRegisters should not be called");
    },
    allocateOrRecycleContextZ: function(needsLarge) {
        throw Error("stack zone: allocateOrRecycleContext should not be called");
    },
    activeContextObjZ: function() {
        // for the few legacy readers that need the active context as an object
        this.nMarryClosure = (this.nMarryClosure || 0) + 1;
        return this.marryFrame(this.zonePage, this.fp);
    },
    tryPrimitiveZ: function(primIndex, argCount, newMethod) {
        if (primIndex === 117) {
            // prim con nombre: cachear la función resuelta en el método
            // (el camino normal reconstruye los strings de módulo/función y
            // hace lookups por nombre EN CADA llamada)
            var fn = newMethod.primFn;
            if (fn === undefined) fn = this.primHandler.resolveNamedPrim(newMethod);
            if (fn !== null) {
                var sp117 = this.sp;
                var page117 = this.zonePage, fp117 = this.fp;
                var ok = fn(argCount);
                if (ok
                    && this.sp !== sp117 - argCount
                    && page117 === this.zonePage && fp117 === this.fp
                    && !this.frozen) {
                    this.warnOnce("stack unbalanced after primitive 117/cached", "error");
                }
                return ok;
            }
            // sin resolver (módulo/función faltante): camino lento con warnings
        }
        if ((primIndex > 255) && (primIndex < 520)) {
            if (primIndex >= 264) {//return instvars
                this.popNandPush(1, this.top().pointers[primIndex - 264]);
                return true;
            }
            switch (primIndex) {
                case 256: //return self
                    return true;
                case 257: this.popNandPush(1, this.trueObj); //return true
                    return true;
                case 258: this.popNandPush(1, this.falseObj); //return false
                    return true;
                case 259: this.popNandPush(1, this.nilObj); //return nil
                    return true;
            }
            this.popNandPush(1, primIndex - 261); //return -1...2
            return true;
        }
        var sp = this.sp;
        var page = this.zonePage, fp = this.fp; // activation identity without touching contexts
        var success = this.primHandler.doPrimitive(primIndex, argCount, newMethod);
        if (success
            && this.sp !== sp - argCount
            && page === this.zonePage && fp === this.fp
            && primIndex !== 117 && primIndex !== 118 && primIndex !== 218
            && !this.frozen) {
                this.warnOnce("stack unbalanced after primitive " + primIndex, "error");
            }
        return success;
    },
});

Object.extend(Squeak.Primitives.prototype,
'stack zone', {
    resolveNamedPrim: function(method) {
        if (this.vm.primFnDebug) console.error("RESOLVE intento");
        // resolver módulo+función del prim 117 una sola vez y cachear en el
        // método un wrapper que replica el protocolo de namedPrimitive
        method.primFn = null;
        if (method.pointersSize() < 2) return null;
        var firstLiteral = method.pointers[1];
        if (firstLiteral.pointersSize() !== 4) return null;
        var moduleName = firstLiteral.pointers[0].bytesAsString();
        var functionName = firstLiteral.pointers[1].bytesAsString();
        if (typeof process !== "undefined" && process.env && process.env.PRIMFN_SKIP
            && (process.env.PRIMFN_SKIP === "*" || process.env.PRIMFN_SKIP.split(",").indexOf(moduleName) >= 0)) return null;
        var mod = moduleName === "" ? this : this.loadedModules[moduleName];
        if (mod === undefined) {
            // loadModule chequea interpreterProxy.failed() tras initialiseModule,
            // que lee el flag `success` AMBIENTE — en el camino original doPrimitive
            // lo resetea al entrar; acá resolvemos antes de ese punto, así que un
            // success=false stale del primitivo anterior hacía "fallar" la carga
            this.success = true;
            mod = this.loadModule(moduleName);
            this.loadedModules[moduleName] = mod;
        }
        if (!mod) return null;
        var primitive = mod[functionName];
        var ph = this, proxy = this.interpreterProxy;
        var inner;
        if (typeof primitive === "function") inner = primitive.bind(mod);
        else if (typeof primitive === "string") inner = this[primitive].bind(this);
        else return null; // missing: que el camino lento warnee
        var wrapper = function(argCount) {
            ph.success = true;
            proxy.argCount = argCount;
            proxy.primitiveName = functionName;
            ph.primMethod = method;
            var r = inner(argCount);
            if (r === true || r === false) return r;
            return ph.success;
        };
        method.primFn = wrapper;
        return wrapper;
    },
    activateNewClosureMethodZ: function(blockClosure, argCount) {
        // old-style (V3) closures: startpc into the home method
        var vm = this.vm;
        var outer = blockClosure.pointers[Squeak.Closure_outerContext];
        var of = outer.frame;
        var method = of != null ? of.page.slots[of.fp + Squeak.Frame_method]
            : outer.pointers[Squeak.Context_method];
        var receiver = of != null ? of.page.slots[of.fp + Squeak.Frame_receiver]
            : outer.pointers[Squeak.Context_receiver];
        var numCopied = blockClosure.pointers.length - Squeak.Closure_firstCopiedValue;
        var slots = vm.zonePage.slots;
        var nfp = vm.sp + 1;
        slots[nfp + Squeak.Frame_savedFp] = vm.fp;
        slots[nfp + Squeak.Frame_savedPc] = vm.pc;
        slots[nfp + Squeak.Frame_method] = method;
        slots[nfp + Squeak.Frame_flags] = argCount;
        slots[nfp + Squeak.Frame_context] = null;
        slots[nfp + Squeak.Frame_closure] = blockClosure;
        slots[nfp + Squeak.Frame_receiver] = receiver;
        var base = nfp + Squeak.Frame_firstTemp;
        for (var i = 0; i < argCount; i++)
            slots[base + i] = slots[nfp - argCount + i];
        for (var i = 0; i < numCopied; i++)
            slots[base + argCount + i] = blockClosure.pointers[Squeak.Closure_firstCopiedValue + i];
        // the initial block instructions nil-out remaining temps (stackp = args+copied)
        vm.fp = nfp;
        vm.sp = base + argCount + numCopied - 1;
        vm.pc = vm.decodeSqueakPC(blockClosure.pointers[Squeak.Closure_startpc], method);
        vm.method = method;
        vm.receiver = receiver;
        vm.tempOffset = base;
        if (method.compiled && vm.jsDepth < 512 && vm.breakOutOfInterpreter === false) {
            vm.jsDepth++;
            method.compiled(vm);
            vm.jsDepth--;
        }
    },
    activateNewFullClosureZ: function(blockClosure, argCount) {
        var vm = this.vm;
        var closureMethod = blockClosure.pointers[Squeak.ClosureFull_method];
        var numCopied = blockClosure.pointers.length - Squeak.ClosureFull_firstCopiedValue;
        var receiver = blockClosure.pointers[Squeak.ClosureFull_receiver];
        var slots = vm.zonePage.slots;
        var nfp = vm.sp + 1;
        slots[nfp + Squeak.Frame_savedFp] = vm.fp;
        slots[nfp + Squeak.Frame_savedPc] = vm.pc;
        slots[nfp + Squeak.Frame_method] = closureMethod;
        slots[nfp + Squeak.Frame_flags] = argCount;
        slots[nfp + Squeak.Frame_context] = null;
        slots[nfp + Squeak.Frame_closure] = blockClosure;
        slots[nfp + Squeak.Frame_receiver] = receiver;
        var tempCount = closureMethod.methodTempCount(); // args + copied + locals
        var base = nfp + Squeak.Frame_firstTemp;
        for (var i = 0; i < argCount; i++)
            slots[base + i] = slots[nfp - argCount + i];
        for (var i = 0; i < numCopied; i++)
            slots[base + argCount + i] = blockClosure.pointers[Squeak.ClosureFull_firstCopiedValue + i];
        for (var i = argCount + numCopied; i < tempCount; i++)
            slots[base + i] = vm.nilObj;
        vm.fp = nfp;
        vm.sp = base + tempCount - 1;
        vm.pc = 0;
        vm.method = closureMethod;
        vm.receiver = receiver;
        vm.tempOffset = base;
        if (!closureMethod.compiled) vm.compileIfPossible(closureMethod);
        if (closureMethod.compiled && vm.jsDepth < 512 && vm.breakOutOfInterpreter === false) {
            vm.jsDepth++;
            closureMethod.compiled(vm);
            vm.jsDepth--;
        }
    },
});
