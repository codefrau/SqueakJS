"use strict";
// Oráculo diferencial para el proyecto stack-zone (ver ../stack-zone-design.md).
//
// Corre una imagen headless en Node con entorno determinista (reloj virtual,
// random sembrado, WebSocket inerte) y acumula un hash de la traza de ejecución
// (sendCount/pc/sp/método en cada slice). Dos corridas del mismo VM producen el
// mismo hash; cualquier divergencia semántica introducida por un VM modificado
// produce otro hash.
//
//   node perf/harness/difftrace.js --golden        graba perf/harness/golden.json
//   node perf/harness/difftrace.js                 compara contra el golden (exit 1 si difiere)
//   node perf/harness/difftrace.js --bench         reloj real, mide wall-time y sends/s
//   opciones: --sends N (default 20000000), --image ruta (default ws/client/cuis.image)

var os = require("os");
var fs = require("fs");
var path = require("path");

var repoRoot = path.join(__dirname, "..", "..");
var args = process.argv.slice(2);
var mode = args.indexOf("--golden") >= 0 ? "golden"
         : args.indexOf("--bench") >= 0 ? "bench"
         : "check";
var useFrames = args.indexOf("--frames") >= 0; // correr con el stack zone activado
var useJit2 = args.indexOf("--jit2") >= 0; // stack-to-register jit (requiere --frames)
var noJit = args.indexOf("--nojit") >= 0; // apagar el jit (para aislar divergencias jit vs frames)
var useUI = args.indexOf("--ui") >= 0; // display offscreen real: levanta el World y ejercita la UI (ver uidisplay.js)
function argValue(name, deflt) {
    var i = args.indexOf(name);
    return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : deflt;
}
var maxSends = parseInt(argValue("--sends", "20000000"), 10);
var untilMs = parseInt(argValue("--until-ms", "0"), 10); // parar al alcanzar este tiempo-virtual (mide "tiempo para el mismo trabajo")
var untilStable = args.indexOf("--until-stable") >= 0; // parar cuando el dibujo se estabiliza (= trabajo real terminado; excluye idle-spin)
var uiW = parseInt(argValue("--width", "1024"), 10);
var uiH = parseInt(argValue("--height", "768"), 10);
// Grabación de eventos (--events): la leemos temprano para dimensionar el display
// headless igual que el browser donde se grabó (coordenadas → mismos morphs).
var evData = null;
if (useUI && argValue("--events", null)) {
    evData = JSON.parse(fs.readFileSync(path.resolve(argValue("--events", null)), "utf8"));
    if (!Array.isArray(evData)) { // wrapper {width, height, events}
        if (args.indexOf("--width") < 0 && evData.width) uiW = evData.width;
        if (args.indexOf("--height") < 0 && evData.height) uiH = evData.height;
    }
}
var imagePath = path.resolve(repoRoot, argValue("--image", "ws/client/cuis.image"));
var goldenPath = path.join(__dirname, "golden.json");
var logPath = argValue("--log", null); // traza por checkpoint, para ubicar divergencias
var logFrom = parseInt(argValue("--logfrom", "-1"), 10); // log fino por-send en [logfrom, logto]
var logTo = parseInt(argValue("--logto", "-1"), 10);

// ---------------------------------------------------------------------------
// Entorno determinista (solo en modos de traza; --bench usa el reloj real)
// ---------------------------------------------------------------------------
var virtualMs = 0;
var VIRTUAL_EPOCH = 1735689600000; // 2025-01-01, fijo
// El reloj virtual queda congelado hasta que arranca el loop de interpretación:
// el boot de Node/carga de imagen consume Date.now un número variable de veces
// (estado frío vs caliente) y no debe correr la línea de tiempo.
var clockRunning = false;
if (mode !== "bench") {
    var clockCalls = 0;
    var virtualNow = function() {
        if (clockRunning && ++clockCalls % 4 === 0) virtualMs++;
        return VIRTUAL_EPOCH + virtualMs;
    };
    // Stub de Date completo: new Date() sin args también debe ser virtual
    // (el código de la imagen loguea timestamps; con reloj real divergen las trazas)
    var RealDate = Date;
    var FakeDate = function Date() {
        if (arguments.length === 0) return new RealDate(virtualNow());
        return new (RealDate.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
    };
    FakeDate.prototype = RealDate.prototype;
    FakeDate.now = virtualNow;
    FakeDate.UTC = RealDate.UTC;
    FakeDate.parse = RealDate.parse;
    global.Date = FakeDate;
    global.performance = { now: function() { return virtualMs; } };
    var seed = 42 >>> 0;
    Math.random = function() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

// ---------------------------------------------------------------------------
// Bootstrapping del VM: mismo esquema que squeak_node.js
// ---------------------------------------------------------------------------
Object.assign(global, {
    self: new Proxy({}, {
        get: function(obj, prop) { return global[prop]; },
        set: function(obj, prop, value) { global[prop] = value; return true; }
    })
});

// WebSocket inerte: la imagen de ws/client intenta conectarse al arrancar; acá
// queda CONNECTING para siempre (el timeout del lado Smalltalk corre con el
// reloj virtual, así que es determinista).
function FakeWebSocket(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null; this.onclose = null; this.onmessage = null; this.onerror = null;
}
FakeWebSocket.prototype.send = function() {};
FakeWebSocket.prototype.close = function() { this.readyState = 3; };
FakeWebSocket.prototype.addEventListener = function() {};
FakeWebSocket.prototype.removeEventListener = function() {};

Object.assign(self, {
    localStorage: {},
    // inerte también en --bench: el workload debe ser idéntico al de la traza
    WebSocket: FakeWebSocket,
    sha1: require(path.join(repoRoot, "lib/sha1")),
    btoa: function(string) { return Buffer.from(string, "ascii").toString("base64"); },
    atob: function(string) { return Buffer.from(string, "base64").toString("ascii"); }
});

[
    "globals.js", "vm.js", "vm.object.js", "vm.object.spur.js", "vm.image.js",
    "vm.interpreter.js", "vm.interpreter.proxy.js", "vm.instruction.stream.js",
    "vm.instruction.stream.sista.js", "vm.instruction.printer.js", "vm.primitives.js",
    "jit.js", "jit2.js", "vm.display.js", "vm.display.headless.js", "vm.input.js",
    "vm.input.headless.js", "vm.plugins.js", "vm.plugins.file.node.js",
    "vm.stackzone.js",
].forEach(function(f) { require(path.join(repoRoot, f)); });

Object.extend(Squeak, {
    vmPath: path.dirname(imagePath) + path.sep,
    platformSubtype: "Node.js",
    osVersion: mode === "bench"
        ? process.version + " " + os.platform() + " " + os.release() + " " + os.arch()
        : "difftrace-deterministic", // la imagen puede leer esto; que no varíe por máquina
    windowSystem: "none",
});

Object.extend(Squeak.Primitives.prototype, {
    loadModuleDynamically: function(modName) {
        try {
            require(path.join(repoRoot, "plugins", modName));
            return Squeak.externalModules[modName];
        } catch (e) {
            console.error("Plugin " + modName + " could not be loaded");
        }
        return undefined;
    }
});

// ---------------------------------------------------------------------------
// Driver síncrono + hash de traza
// ---------------------------------------------------------------------------
var hash = 2166136261 >>> 0; // FNV-1a
var mixLog = process.env.MIXLOG ? [] : null;
function mix(v) {
    if (mixLog) mixLog.push(v);
    hash = (hash ^ (v >>> 0)) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
}
process.on("exit", function() {
    if (mixLog) require("fs").writeFileSync(process.env.MIXLOG, mixLog.join("\n") + "\n");
});

// La imagen escribe artefactos junto a sí misma (crea el .changes si falta,
// logs de debug). Limpiarlos antes de correr para que toda corrida parta del
// mismo estado de filesystem — si no, la primera corrida en un clone fresco
// difiere de las siguientes.
var imageDir = path.dirname(imagePath);
var imageBase = path.basename(imagePath, ".image");
fs.readdirSync(imageDir).forEach(function(f) {
    if (f === imageBase + ".changes" || /^CuisDebug-.*\.log$/.test(f)) {
        fs.unlinkSync(path.join(imageDir, f));
    }
});

if (process.env.PERCLASS === "1") Squeak.perClassShape = true; // A/B: volver a constructores por-clase (revertir monomorfización)
var data = fs.readFileSync(imagePath);
var image = new Squeak.Image(imagePath.replace(/\.image$/, ""));
image.readFromBuffer(data.buffer, function startRunning() {
    var uiMod = null, display;
    if (useUI) {
        uiMod = require(path.join(__dirname, "uidisplay.js"));
        display = uiMod.install(Squeak, { width: uiW, height: uiH });
    } else {
        display = { vmOptions: ["-vm-display-null", "-nodisplay"] };
    }
    var vm = new Squeak.Interpreter(image, display, useFrames ? { stackZone: true, jit2: useJit2 } : {});
    if (noJit) vm.compiler = null;
    if (process.env.LARGEINT === "0") vm.primHandler.largeIntPrims = false; // A/B: desactivar prims LargeInteger
    if (process.env.STREAMPRIM === "0") vm.primHandler.streamPrims = false; // A/B: desactivar prims Stream 65/66/67
    if (process.env.JIT2DBG) vm.jit2Debug = true;
    if (process.env.SEMDBG) {
        var origSS = vm.primHandler.synchronousSignal;
        vm.primHandler.synchronousSignal = function(sema) {
            if (vm.sendCount >= 717670 && vm.sendCount <= 717685)
                console.error("SIG s=" + vm.sendCount + " semaHash=" + sema.hash
                    + " excess=" + sema.pointers[Squeak.Sema_excessSignals]
                    + " empty=" + this.isEmptyList(sema)
                    + " firstLink=" + (sema.pointers[Squeak.LinkedList_firstLink].isNil ? "nil" : "proc:" + sema.pointers[Squeak.LinkedList_firstLink].hash));
            return origSS.call(this, sema);
        };
        var origWait = vm.primHandler.primitiveWait || null;
    }
    if (process.env.GCDBG) {
        var origFGR = vm.frameGCRoots;
        var fgrCalls = 0;
        vm.frameGCRoots = function() {
            var roots = origFGR.call(vm);
            if (++fgrCalls <= 2) {
                var desc = [];
                for (var i = 0; i < vm.zonePages.length; i++) {
                    var pg = vm.zonePages[i];
                    desc.push((pg.live ? "L" : "d") + " fp=" + pg.fp + " sp=" + pg.sp + " len=" + pg.slots.length);
                }
                console.error("FGR#" + fgrCalls + " s=" + vm.sendCount + " roots=" + roots.length + " | " + desc.join(" | "));
            }
            return roots;
        };
    }
    if (process.env.CHKDBG) {
        var origCFI = vm.checkForInterrupts;
        vm.checkForInterrupts = function() {
            console.error("CHK s=" + vm.sendCount + " vms=" + virtualMs + " reset=" + vm.interruptCheckCounterFeedBackReset + " wake=" + vm.nextWakeupTick);
            return origCFI.call(vm);
        };
    }
    if (process.env.ZDBG9) {
        // volcar bytes+literales del método activado cuando mbytes coincide
        var z9size = parseInt(process.env.ZDBG9_SIZE), z9From = parseInt(process.env.ZDBG9_FROM || "0");
        var origENM9 = vm.executeNewMethod;
        var dumped = 0;
        vm.executeNewMethod = function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
            if (vm.sendCount >= z9From && dumped < 2 && newMethod.bytes && newMethod.bytes.length === z9size) {
                dumped++;
                var lits = [];
                for (var i = 0; i < newMethod.pointers.length; i++) {
                    var l = newMethod.pointers[i];
                    lits.push(l && l.bytesAsString ? l.bytesAsString() : (l && l.sqClass ? l.sqClass.className() : String(l)));
                }
                console.error("MDUMP s=" + vm.sendCount + " sel=" + (optSel && optSel.bytesAsString ? optSel.bytesAsString() : "?")
                    + " bytes=[" + Array.prototype.join.call(newMethod.bytes, ",") + "] lits=" + JSON.stringify(lits));
            }
            return origENM9.call(vm, newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel);
        };
    }
    if (process.env.PFNDBG) vm.primFnDebug = true;
    if (process.env.COUNTBV) {
        var ph = vm.primHandler, cnt = { blockValue:0, blockValueArgs:0, closureAct:0, closureActFull:0 };
        var o1 = ph.primitiveBlockValue.bind(ph); ph.primitiveBlockValue = function(a){ cnt.blockValue++; return o1(a); };
        var o2 = ph.primitiveBlockValueWithArgs.bind(ph); ph.primitiveBlockValueWithArgs = function(a){ cnt.blockValueArgs++; return o2(a); };
        if (ph.activateNewClosureMethod) { var o3 = ph.activateNewClosureMethod.bind(ph); ph.activateNewClosureMethod = function(b,a){ cnt.closureAct++; return o3(b,a); }; }
        process.on("exit", function(){ console.error("COUNTBV " + JSON.stringify(cnt) + " byClosure(marriages)=" + (vm.nMarryClosure||0)); });
    }
    if (process.env.CLEANBLK) {
        // ¿cuántos closures son "clean" (nunca usan su outerContext)? Un clean block
        // no necesitaría casar el frame → eliminaría marriages del stack zone.
        // Conservador: clean = numCopied 0 Y ningún bytecode que toque estado externo
        // (rcvr vars/self/thisContext/^/remote temps/extendidos que podrían).
        var dirty = {}; [0x70,0x7C,0x81,0x82,0x84,0x85,0x89,0x8C,0x8D,0x8E].forEach(function(b){dirty[b]=1;});
        var stats = { total:0, clean:0, numCopied0:0, byCopied:{} };
        var origPCC = vm.pushClosureCopy.bind(vm);
        vm.pushClosureCopy = function() {
            var savedPc = vm.pc, m = vm.method;
            var nac = m.bytes[vm.pc], numCopied = nac >> 4;
            var bsHi = m.bytes[vm.pc+1], blockSize = bsHi*256 + m.bytes[vm.pc+2];
            var blockStart = vm.pc + 3, isClean = (numCopied === 0);
            if (isClean) for (var p = blockStart; p < blockStart + blockSize; p++) {
                var b = m.bytes[p];
                if (b <= 0x0F || (b >= 0x60 && b <= 0x67) || dirty[b]) { isClean = false; break; }
            }
            stats.total++;
            if (numCopied === 0) stats.numCopied0++;
            stats.byCopied[numCopied] = (stats.byCopied[numCopied]||0)+1;
            if (isClean) stats.clean++;
            return origPCC();
        };
        process.on("exit", function(){
            console.error("CLEANBLK closures=" + stats.total + " clean=" + stats.clean
                + " (" + (100*stats.clean/stats.total).toFixed(1) + "%) numCopied0=" + stats.numCopied0
                + " (" + (100*stats.numCopied0/stats.total).toFixed(1) + "%) byCopied=" + JSON.stringify(stats.byCopied));
        });
    }
    if (process.env.HOTSEL) {
        // top métodos Smalltalk por activaciones (rcvrClass>>selector) — muestra
        // en qué gasta sends la imagen real (¿desperdicio algorítmico o costo base?)
        var hot = {};
        var origENMh = vm.executeNewMethod;
        vm.executeNewMethod = function(r, m, ac, pi, oc, sel) {
            var key = (oc ? oc.className() : (vm.getClass(r).className())) + ">>" + (sel && sel.bytesAsString ? sel.bytesAsString() : "?");
            hot[key] = (hot[key] || 0) + 1;
            return origENMh.call(vm, r, m, ac, pi, oc, sel);
        };
        process.on("exit", function() {
            var arr = Object.keys(hot).map(function(k){ return [k, hot[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
            var tot = arr.reduce(function(s,e){ return s+e[1]; }, 0);
            console.error("HOTSEL top 30 de " + arr.length + " selectores (" + tot + " sends):");
            arr.slice(0, 30).forEach(function(e){ console.error("  " + (100*e[1]/tot).toFixed(1) + "%  " + e[1] + "  " + e[0]); });
            // agregado por clase receptora
            var byC = {};
            arr.forEach(function(e){ var c = e[0].split(">>")[0]; byC[c] = (byC[c]||0) + e[1]; });
            var carr = Object.keys(byC).map(function(k){ return [k, byC[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
            console.error("HOTSEL top 15 por CLASE receptora:");
            carr.slice(0, 15).forEach(function(e){ console.error("  " + (100*e[1]/tot).toFixed(1) + "%  " + e[1] + "  " + e[0]); });
            var largeInt = (byC["LargePositiveInteger"]||0) + (byC["LargeNegativeInteger"]||0);
            console.error("→ LargeInteger (receptor): " + (100*largeInt/tot).toFixed(1) + "% de sends");
        });
    }
    if (process.env.UNWINDDBG) {
        // cobertura: contar activaciones por selector (watchlist de unwind/terminación)
        // + process switches + resumes de contextos casados. Responde "¿el workload
        // siquiera toca los paths donde crashea el browser?"
        var watch = (process.env.UNWINDDBG_SEL ||
            "terminateTo:,resume:through:,resume:,aboutToReturn:through:,cannotReturn:,valueUninterruptably")
            .split(",");
        var counts = {}; watch.forEach(function(s){ counts[s]=0; });
        counts["<transferTo/processSwitch>"] = 0;
        counts["<resume married ctx>"] = 0;
        var origENMu = vm.executeNewMethod;
        vm.executeNewMethod = function(r, m, ac, pi, oc, sel) {
            if (sel && sel.bytesAsString) { var s = sel.bytesAsString(); if (counts[s] !== undefined) counts[s]++; }
            return origENMu.call(vm, r, m, ac, pi, oc, sel);
        };
        var origTTu = vm.primHandler.transferTo;
        vm.primHandler.transferTo = function(p){ counts["<transferTo/processSwitch>"]++; return origTTu.call(this,p); };
        if (vm.newActiveContext) {
            var origNACu = vm.newActiveContext;
            vm.newActiveContext = function(c){ if (vm.useStackZone && c && c.frame != null) counts["<resume married ctx>"]++; return origNACu.call(vm,c); };
        }
        process.on("exit", function(){ console.error("UNWIND cobertura:", JSON.stringify(counts)); });
    }
    if (process.env.SSDBG) {
        var c2 = vm.compiler;
        if (c2) {
            var origESS = c2.enableSingleStepping.bind(c2);
            c2.enableSingleStepping = function(method, optClass, optSel) {
                vm.nSingleStep = (vm.nSingleStep || 0) + 1;
                if (vm.nSingleStep <= 5) console.error("SINGLESTEP #" + vm.nSingleStep + " s=" + vm.sendCount + " pc=" + vm.pc + " mbytes=" + (method.bytes ? method.bytes.length : "?"));
                return origESS(method, optClass, optSel);
            };
        }
    }
    if (process.env.FREEZE_SIM) {
        // replica el patrón del FilePlugin del browser (fileContentsDo):
        // el primitivo congela el VM y retorna true sin efecto de stack; un
        // callback diferido hace unfreeze() y LUEGO aplica el efecto original
        var wrapFrozen = function(mod, fnName) {
            var orig = mod[fnName].bind(mod);
            mod[fnName] = function(argCount) {
                if (vm.frozen) return orig(argCount); // ya diferido: ejecutar directo
                vm.nFreezeSim = (vm.nFreezeSim || 0) + 1;
                vm.freeze(function(unfreeze) {
                    setImmediate(function() {
                        unfreeze();
                        orig(argCount);
                    });
                });
                return true;
            };
        };
        var origLM2 = vm.primHandler.loadModule.bind(vm.primHandler);
        vm.primHandler.loadModule = function(name) {
            var m = origLM2(name);
            if (name === "FilePlugin" && m && !m._frozenSim) {
                m._frozenSim = true;
                for (var k in m)
                    if (typeof m[k] === "function" && /^primitive/.test(k))
                        wrapFrozen(m, k);
            }
            return m;
        };
    }
    if (process.env.PAGEDBG) { vm.pageStats = {fresh:0, reused:0, flushActive:0, flushSusp:0, flushDead:0}; process.on("exit", function(){ console.error("PAGES:", JSON.stringify(vm.pageStats)); }); }
    if (process.env.SMCDBG) { vm.smcStats = {}; process.on("exit", function() { console.error("SMC stores por índice:", JSON.stringify(vm.smcStats)); }); }
    if (process.env.FADBG) {
        // loguear llamadas a FloatArrayPlugin.primitiveAt: (sc, sp-antes, success-después, sp-después)
        var faCount = 0;
        var patchFA = function(mod) {
            if (!mod || mod._faPatched) return !!mod;
            mod._faPatched = true;
            var orig = mod.primitiveAt;
            mod.primitiveAt = function(argCount) {
                var spBefore = vm.sp;
                var r = orig.call(this, argCount);
                if (++faCount <= 40)
                    console.error("FA#" + faCount + " s=" + vm.sendCount + " spB=" + spBefore
                        + " r=" + r + " succ=" + vm.primHandler.success + " spA=" + vm.sp);
                return r;
            };
            return true;
        };
        var origLMD = vm.primHandler.loadModule.bind(vm.primHandler);
        vm.primHandler.loadModule = function(name) {
            var m = origLMD(name);
            if (name === "FloatArrayPlugin") patchFA(m);
            return m;
        };
    }
    if (process.env.ZDBG7) {
        // dump de cadena al activar un método específico (por _traceId)
        var z7id = parseInt(process.env.ZDBG7_ID), z7From = parseInt(process.env.ZDBG7_FROM || "0");
        var chainDesc = function() {
            var desc = [];
            if (vm.useStackZone) {
                var page = vm.zonePage, fp = vm.fp, hops = 0;
                while (fp >= 0 && hops++ < 20) {
                    var m = page.slots[fp + Squeak.Frame_method];
                    var cl = page.slots[fp + Squeak.Frame_closure];
                    desc.push("m" + (m.bytes ? m.bytes.length : "?") + (cl && !cl.isNil ? "b" : ""));
                    fp = page.slots[fp + Squeak.Frame_savedFp];
                }
                if (fp < 0) desc.push("BASE:" + (page.baseCallerCtx && !page.baseCallerCtx.isNil ? "ctx" : "nil"));
            } else {
                var ctx = vm.activeContext, hops = 0;
                while (!ctx.isNil && hops++ < 20) {
                    var m2 = ctx.pointers[Squeak.Context_method];
                    var cl2 = ctx.pointers[Squeak.Context_closure];
                    desc.push("m" + (m2.bytes ? m2.bytes.length : (vm.isSmallInt(m2) ? "INT" : "?")) + (cl2 && !cl2.isNil ? "b" : ""));
                    ctx = ctx.pointers[Squeak.Context_sender];
                }
            }
            return desc.join("<");
        };
        var origENM7 = vm.executeNewMethod;
        vm.executeNewMethod = function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
            var r = origENM7.call(vm, newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel);
            if (vm.sendCount >= z7From && newMethod._traceId === z7id)
                console.error("ACT s=" + vm.sendCount + " chain: " + chainDesc());
            return r;
        };
    }
    if (process.env.ZDBG6) {
        var origTT = vm.primHandler.transferTo;
        vm.primHandler.transferTo = function(newProc) {
            console.error("TT s=" + vm.sendCount);
            return origTT.call(this, newProc);
        };
    }
    if (process.env.ZDBG5) {
        // historial de activaciones de contexto explícitas (process switch / value de
        // contextos dormidos) en ambos modos
        var origNAC = vm.newActiveContext;
        vm.newActiveContext = function(newContext) {
            var m = newContext.pointers[Squeak.Context_method];
            console.error("NAC s=" + vm.sendCount
                + " mbytes=" + (m && m.bytes ? m.bytes.length : "int?")
                + " senderNil=" + (newContext.pointers[Squeak.Context_sender].isNil === true)
                + (vm.useStackZone ? " frame=" + (newContext.frame != null) : ""));
            return origNAC.call(vm, newContext);
        };
    }
    if (process.env.ZDBG4) {
        // atrapar escrituras de campos de contexts en modo contexts:
        // via bytecode (storeInstVar) y via primitivos (objectAtPut/storeStackp)
        var ctxClass = vm.specialObjects[Squeak.splOb_ClassMethodContext];
        var origSIV = vm.storeInstVar;
        var sivCount = 0;
        vm.storeInstVar = function(index, value) {
            if (++sivCount <= 3) console.error("SIV-ALIVE #" + sivCount + " s=" + vm.sendCount + " rcls=" + this.getClass(this.receiver).className());
            if (this.receiver.sqClass === ctxClass)
                console.error("CTXSTORE s=" + vm.sendCount + " idx=" + index + " val=" + (value && value.isNil ? "nil" : typeof value));
            return origSIV.call(this, index, value);
        };
        var origOAP = vm.primHandler.objectAtPut;
        vm.primHandler.objectAtPut = function(a, b, c) {
            var rcvr = this.stackNonInteger(2);
            if (rcvr.sqClass === ctxClass)
                console.error("CTXATPUT s=" + vm.sendCount + " idx=" + this.stackPos32BitInt(1));
            return origOAP.call(this, a, b, c);
        };
        var origSSP = vm.primHandler.primitiveStoreStackp;
        vm.primHandler.primitiveStoreStackp = function(argCount) {
            console.error("CTXSTACKP s=" + vm.sendCount);
            return origSSP.call(this, argCount);
        };
    }
    if (process.env.ZDBG3) {
        // dump de cadenas en la ventana: frames (fp chain) vs contexts (sender chain)
        var z3From = parseInt(process.env.ZDBG3_FROM || "0"), z3To = parseInt(process.env.ZDBG3_TO || "99999999");
        var origDR = vm.doReturn;
        vm.doReturn = function(returnValue, targetContext) {
            if (vm.sendCount >= z3From && vm.sendCount <= z3To) {
                var desc = [];
                if (vm.useStackZone) {
                    var page = vm.zonePage, fp = vm.fp, hops = 0;
                    while (fp >= 0 && hops++ < 12) {
                        var m = page.slots[fp + Squeak.Frame_method];
                        var cl = page.slots[fp + Squeak.Frame_closure];
                        desc.push(fp + ":m" + (m.bytes ? m.bytes.length : "?") + (cl && !cl.isNil ? "[blk]" : ""));
                        fp = page.slots[fp + Squeak.Frame_savedFp];
                    }
                    if (fp < 0) desc.push("base->" + (page.baseCallerCtx && !page.baseCallerCtx.isNil ? "ctx" : "nil"));
                } else {
                    var ctx = vm.activeContext, hops = 0;
                    while (!ctx.isNil && hops++ < 12) {
                        var m2 = ctx.pointers[Squeak.Context_method];
                        var cl2 = ctx.pointers[Squeak.Context_closure];
                        desc.push("m" + (m2.bytes ? m2.bytes.length : "?") + (cl2 && !cl2.isNil ? "[blk]" : ""));
                        ctx = ctx.pointers[Squeak.Context_sender];
                    }
                }
                console.error("DR s=" + vm.sendCount + " pc=" + vm.pc + " chain: " + desc.join(" <- "));
            }
            return origDR.call(vm, returnValue, targetContext);
        };
    }
    if (process.env.ZDBG) {
        var zFrom = parseInt(process.env.ZDBG_FROM || "0"), zTo = parseInt(process.env.ZDBG_TO || "99999999");
        var origANC = vm.primHandler.activateNewClosureMethod;
        vm.primHandler.activateNewClosureMethod = function(blockClosure, argCount) {
            if (vm.sendCount >= zFrom && vm.sendCount <= zTo) {
                var outer = blockClosure.pointers[Squeak.Closure_outerContext];
                var m = outer.frame != null ? outer.frame.page.slots[outer.frame.fp + Squeak.Frame_method]
                    : outer.pointers[Squeak.Context_method];
                console.error("ANC s=" + vm.sendCount + " startpc=" + blockClosure.pointers[Squeak.Closure_startpc]
                    + " mlits=" + (m.pointers ? m.pointers.length : "?") + " mbytes=" + (m.bytes ? m.bytes.length : "?")
                    + " outerMarried=" + (outer.frame != null) + " isNilM=" + (m.isNil === true));
            }
            var r = origANC.call(this, blockClosure, argCount);
            if (vm.sendCount >= zFrom && vm.sendCount <= zTo && !vm._zdbgArmed) {
                vm._zdbgArmed = 60;
                var origIO = vm.interpretOne.bind(vm);
                vm.interpretOne = function(singleStep) {
                    if (vm._zdbgArmed-- > 0)
                        console.error("BC pc=" + vm.pc + " byte=" + vm.method.bytes[vm.pc]
                            + " mbytes=" + vm.method.bytes.length + " sp=" + vm.sp + " fp=" + vm.fp);
                    return origIO(singleStep);
                };
            }
            return r;
        };
    }
    var slices = 0, idleStreak = 0, stopReason = "maxSends";
    var logLines = logPath ? [] : null;
    if (mode !== "bench") {
        // Muestreo en checkpoints fijos de sendCount: independiente de la
        // representación (contexts/frames) Y de la cadencia de interrupciones
        // (que difiere con/sin jit). Es la señal que entra al hash.
        var traceIdOf = function(m) {
            if (m._traceId === undefined) {
                var fpv = m.bytes ? m.bytes.length : 0;
                if (m.bytes) for (var bi = 0; bi < Math.min(m.bytes.length, 16); bi++)
                    fpv = ((fpv * 31) + m.bytes[bi]) | 0;
                m._traceId = fpv;
            }
            return m._traceId;
        };
        // leaf-sends: mismo muestreo que executeNewMethod (sc = sendCount pre-incremento)
        vm.jit2HookFires = 0;
        vm.jit2LeafHook = function(method, sc, rcvr, sel) {
            vm.jit2HookFires++;
            if (sc < maxSends && (sc & 4095) === 0) {
                mix(sc);
                mix(traceIdOf(method));
                mix(vm.pc);
                if (logLines) logLines.push("s=" + sc + " h=" + traceIdOf(method) + " pc=" + vm.pc);
            }
            if (logLines && sc >= logFrom && sc <= logTo)
                logLines.push("S=" + sc + " h=" + traceIdOf(method) + " pc=" + vm.pc + " args=? prim=0"
                    + " cm=" + (vm.method ? traceIdOf(vm.method) : "?")
                    + " rcls=" + vm.getClass(rcvr).className() + " sel=" + (sel && sel.bytesAsString ? sel.bytesAsString() : "?") + " [leaf]");
        };
        var origENM = vm.executeNewMethod;
        vm.executeNewMethod = function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
            // método identificado por fingerprint de contenido (los oops temporales
            // interleavan contexts y difieren entre representaciones; el identity
            // hash de métodos de imagen V3 es 0)
            if (newMethod._traceId === undefined) {
                var fp = newMethod.bytes ? newMethod.bytes.length : 0;
                if (newMethod.bytes) for (var bi = 0; bi < Math.min(newMethod.bytes.length, 16); bi++)
                    fp = ((fp * 31) + newMethod.bytes[bi]) | 0;
                newMethod._traceId = fp;
            }
            if (vm.sendCount < maxSends && (vm.sendCount & 4095) === 0) {
                mix(vm.sendCount);
                mix(newMethod._traceId);
                mix(vm.pc);
                if (logLines) logLines.push("s=" + vm.sendCount + " h=" + newMethod._traceId + " pc=" + vm.pc + " vms=" + virtualMs + " alloc=" + (vm.image.newSpaceCount + vm.image.allocationCount));
            }
            if (logLines && vm.sendCount >= logFrom && vm.sendCount <= logTo) {
                if (vm.method && vm.method._traceId === undefined) {
                    var fp2 = vm.method.bytes ? vm.method.bytes.length : 0;
                    if (vm.method.bytes) for (var bj = 0; bj < Math.min(vm.method.bytes.length, 16); bj++)
                        fp2 = ((fp2 * 31) + vm.method.bytes[bj]) | 0;
                    vm.method._traceId = fp2;
                }
                logLines.push("S=" + vm.sendCount + " h=" + newMethod._traceId + " pc=" + vm.pc + " args=" + argumentCount + " prim=" + primitiveIndex
                    + " cm=" + (vm.method ? vm.method._traceId : "?")
                    + " rcls=" + vm.getClass(newRcvr).className() + " sel=" + (optSel && optSel.bytesAsString ? optSel.bytesAsString() : "?"));
            }
            return origENM.call(vm, newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel);
        };
    }
    // Agenda de eventos de entrada (solo --ui). Determinista: cada evento se
    // inyecta al cruzar su umbral de sendCount, idéntico entre representaciones.
    var evSched = null, evIdx = 0;
    if (useUI) {
        var evFile = argValue("--events", null);
        if (evFile) {
            // Grabado con #record del browser: [ {at: sendCount, ev:[type,ts,...]}, ... ].
            // Se rebasa: el 1er evento cae en --evstart y los deltas de sendCount del
            // browser se preservan pero capados a --evgap (comprime las pausas del
            // usuario). También acepta el formato plano [ [type,ms,...], ... ].
            var raw = Array.isArray(evData) ? evData : evData.events;
            var evStart = parseInt(argValue("--evstart", "800000"), 10);
            var evGapCap = parseInt(argValue("--evgap", "250000"), 10);
            if (raw.length && Array.isArray(raw[0])) {
                evSched = raw.map(function(e, i) { return { at: Math.floor(maxSends * (0.3 + 0.6 * i / raw.length)), ev: e }; });
            } else {
                var acc = evStart, prev = raw.length ? raw[0].at : 0;
                evSched = raw.map(function(e) {
                    var gap = Math.min(Math.max(0, e.at - prev), evGapCap);
                    acc += gap; prev = e.at;
                    return { at: acc, ev: e.ev };
                });
            }
        } else {
            evSched = uiMod.syntheticScript(uiW, uiH, Math.floor(maxSends * 0.5), Math.floor(maxSends * 0.9));
        }
        var lastAt = evSched.length ? evSched[evSched.length - 1].at : 0;
        console.log("eventos agendados: " + evSched.length + (evFile ? " (de " + evFile + ", último en send " + lastAt + ")" : " (sintéticos)")
            + (lastAt > maxSends ? "  ⚠️ subí --sends a >" + lastAt + " para no cortar la interacción" : ""));
    }
    function injectDueEvents() {
        if (!evSched) return;
        while (evIdx < evSched.length && vm.sendCount >= evSched[evIdx].at) {
            var e = evSched[evIdx++].ev.slice();
            e[1] = vm.primHandler.millisecondClockValue(); // ts en el dominio del reloj del VM
            // reflejar posición/botones en el display para los prims de polling
            if (e[0] === 1) { display.mouseX = e[2]; display.mouseY = e[3]; display.buttons = e[4]; }
            display.eventQueue.push(e);
            if (display.signalInputEvent) display.signalInputEvent();
            display.idle = 0;
        }
    }

    // Detección de quiescencia: el dibujo dejó de cambiar por 2 chequeos seguidos
    // (~1M sends) y no quedan eventos → el trabajo real terminó. Mide el costo de
    // la acción sin el idle-spin que el clock-warp sobre-representa.
    var stLastHash = null, stStable = 0, stLastCheck = 0;
    function checkStable() {
        if (!untilStable || !uiMod) return false;
        if (vm.sendCount - stLastCheck < 500000) return false;
        stLastCheck = vm.sendCount;
        var fp = uiMod.displayFingerprint(vm), h = fp ? fp.hash : null;
        var eventsDone = !evSched || evIdx >= evSched.length;
        if (h && h === stLastHash && eventsDone) { if (++stStable >= 2) return true; }
        else stStable = 0;
        stLastHash = h;
        return false;
    }

    var noop = function() {};
    var wallStart = process.hrtime.bigint();
    clockRunning = true;
    mainLoop();
    async function mainLoop() {
    try {
        var frozenYields = 0;
        while (vm.sendCount < maxSends) {
            if (display.quitFlag) { stopReason = "quit"; break; }
            if (untilMs > 0 && virtualMs >= untilMs) { stopReason = "untilMs"; break; }
            if (vm.frozen) {
                // ceder el event loop para que el unfreeze diferido corra
                if (++frozenYields > 1000000) { stopReason = "frozen-livelock"; break; }
                await new Promise(function(r) { setImmediate(r); });
                continue;
            }
            injectDueEvents();
            var result = vm.interpret(5, noop); // thenDo: freeze necesita continueFunc
            if (result === "frozen") continue;
            slices++;
            if (checkStable()) { stopReason = "stable"; break; }
            // el hash se alimenta solo de los checkpoints por sendCount (arriba);
            // los límites de slice dependen de la cadencia de interrupciones,
            // que varía entre modos (jit/no-jit) sin implicar divergencia semántica
            if (result === "sleep") {
                // todos los procesos esperan sin timer: nada más va a pasar
                if (++idleStreak >= 3) { stopReason = "idle"; break; }
                warpClock(vm, 10);
            } else if (typeof result === "number" && result > 1) {
                // todos esperan hasta un timer futuro: saltar la espera
                warpClock(vm, result);
                idleStreak = 0;
            } else if (result === "break") {
                stopReason = "breakpoint"; break;
            } else {
                idleStreak = 0;
            }
        }
    } catch (e) {
        stopReason = "error: " + e.message;
        if (process.env.DIFFTRACE_DEBUG) console.error(e.stack);
    }
    var wallMs = Number(process.hrtime.bigint() - wallStart) / 1e6;
    if (logLines) fs.writeFileSync(logPath, logLines.join("\n") + "\n");

    function warpClock(vm, ms) {
        if (mode === "bench") {
            // adelantar el reloj del VM (startupTime) para no esperar de verdad
            var now = vm.primHandler.millisecondClockValue();
            vm.primHandler.millisecondClockValueSet(now + ms);
        } else {
            virtualMs += ms;
        }
    }

    var fp = uiMod ? uiMod.displayFingerprint(vm) : null;
    var report = {
        image: path.relative(repoRoot, imagePath),
        maxSends: maxSends,
        sendCount: vm.sendCount,
        slices: slices,
        stopReason: stopReason,
        hash: hash.toString(16),
        virtualMs: virtualMs,
        displayHash: fp ? fp.hash : undefined,
    };

    if (mode === "bench") {
        console.log("bench: " + vm.sendCount + " sends en " + wallMs.toFixed(0) + " ms  (" +
            (vm.sendCount / (wallMs / 1000) / 1e6).toFixed(2) + "M sends/s), stop: " + stopReason);
        if (vm.useStackZone) {
            console.log("leaf calls=" + vm.nLeafCalls + " deopts=" + vm.nLeafDeopts
                + " (de " + vm.sendCount + " sends)");
            var live = 0, maxSlots = 0;
            for (var i = 0; i < vm.zonePages.length; i++) {
                if (vm.zonePages[i].live) live++;
                if (vm.zonePages[i].slots.length > maxSlots) maxSlots = vm.zonePages[i].slots.length;
            }
            var vacias = 0;
            for (var i = 0; i < vm.zonePages.length; i++)
                if (vm.zonePages[i].live && vm.zonePages[i].fp < 0) vacias++;
            console.log("pages live vacías (fp<0): " + vacias + " flushPage=" + (vm.nFlushPage || 0));
            console.log("zona: pages=" + vm.zonePages.length + " live=" + live + " maxSlots=" + maxSlots
                + " married=" + (vm.nMarriedContexts || 0) + " flushAll=" + (vm.nFlushAll || 0)
                + " byClosure=" + (vm.nMarryClosure || 0) + " byThisCtx=" + (vm.nMarryThisCtx || 0)
                + " bySenderFill=" + (vm.nMarrySenderFill || 0));
        }
        return;
    }

    if (vm.compiler && vm.compiler.okCount !== undefined)
        console.log("jit2: ok=" + vm.compiler.okCount + " bail=" + vm.compiler.bailCount
            + " leaves=" + (vm.compiler.leafCount || 0)
            + " leafCalls=" + vm.nLeafCalls + " deopts=" + vm.nLeafDeopts);
    if (vm.useStackZone)
        console.log("married=" + (vm.nMarriedContexts||0) + " byClosure=" + (vm.nMarryClosure||0)
            + " byThisCtx=" + (vm.nMarryThisCtx||0) + " bySenderFill=" + (vm.nMarrySenderFill||0));
    if (vm.nFreezeSim) console.log("freezes simulados: " + vm.nFreezeSim + " singleSteps: " + (vm.nSingleStep || 0));
    if (fp) console.log("display: " + fp.w + "x" + fp.h + " depth=" + fp.depth
        + " hash=" + fp.hash + " nonzero=" + fp.nonzero + "/" + (fp.words || "?") + " words"
        + " damage=" + (display.damage ? JSON.stringify(display.damage) : "none")
        + " eventsLeft=" + (display.eventQueue ? display.eventQueue.length : "?"));
    console.log("trace: sends=" + report.sendCount + " slices=" + report.slices +
        " stop=" + report.stopReason + " hash=" + report.hash + " virtualMs=" + report.virtualMs +
        "  (wall " + wallMs.toFixed(0) + " ms)");

    if (mode === "golden") {
        fs.writeFileSync(goldenPath, JSON.stringify(report, null, 2) + "\n");
        console.log("golden grabado en " + path.relative(repoRoot, goldenPath));
    } else {
        if (!fs.existsSync(goldenPath)) {
            console.error("no hay golden.json — corré primero con --golden");
            process.exit(2);
        }
        var golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
        // slices/virtualMs/sendCount-final quedan fuera de la comparación:
        // dependen de la cadencia de interrupciones y la granularidad del slice,
        // no de la semántica
        var keys = ["image", "maxSends", "stopReason", "hash"];
        if (golden.displayHash !== undefined && report.displayHash !== undefined) keys.push("displayHash");
        var diffs = keys.filter(function(k) { return String(golden[k]) !== String(report[k]); });
        if (diffs.length === 0) {
            console.log("OK: traza idéntica al golden");
        } else {
            diffs.forEach(function(k) {
                console.error("DIVERGE " + k + ": golden=" + golden[k] + " actual=" + report[k]);
            });
            process.exit(1);
        }
    }
    } // fin mainLoop
});
