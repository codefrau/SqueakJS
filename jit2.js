"use strict";
/*
 * jit2: stack-to-register mapping compiler for stack-zone mode.
 *
 * Compiles V3(+closures) methods to JS functions where operand-stack slots
 * live in JS locals (s0, s1, ...) whose depth is tracked at compile time.
 * Slots are spilled to the zone only at send sites (where the frame must be
 * observable/resumable) and reloaded on trampoline re-entry, distinguished
 * from internal jumps by a function-local `entering` flag. Each send site
 * has a monomorphic inline cache (class -> method/primitive), bypassing
 * findSelectorInClass on hits. Unsupported bytecodes bail the whole method
 * to the jit1 template compiler.
 *
 * Only active in stack-zone mode (generated code assumes frames).
 */

Squeak.LEAF_DEOPT = { leafDeopt: true }; // sentinel: el leaf no pudo, re-ejecutar framed

Object.subclass('Squeak.Compiler2',
'initialization', {
    initialize: function(vm) {
        this.vm = vm;
        this.fallback = new Squeak.Compiler(vm);
        this.bailCount = 0;
        this.okCount = 0;
    },
},
'accessing', {
    compile: function(method, optClassObj, optSelObj) {
        if (method.compiled === undefined) {
            method.compiled = false; // 1st time: defer (same policy as jit1)
            return;
        }
        if (method.methodSignFlag() // Sista: not supported yet
            || (typeof process !== "undefined" && process.env && process.env.JIT2BAIL)) {
            return this.fallback.compile(method, optClassObj, optSelObj);
        }
        // bisección de bugs: JIT2SEL="div,resto" compila con jit2 solo métodos
        // cuyo fingerprint % div === alguno de los restos listados
        if (typeof process !== "undefined" && process.env && process.env.JIT2SEL) {
            var parts = process.env.JIT2SEL.split(",").map(Number);
            var div = parts[0];
            var fpr = method.bytes ? method.bytes.length : 0;
            if (method.bytes) for (var bi = 0; bi < Math.min(method.bytes.length, 16); bi++)
                fpr = ((fpr * 31) + method.bytes[bi]) | 0;
            var rem = ((fpr % div) + div) % div;
            if (parts.indexOf(rem, 1) < 0)
                return this.fallback.compile(method, optClassObj, optSelObj);
        }
        var clsName = optClassObj && optClassObj.className(),
            sel = optSelObj && optSelObj.bytesAsString();
        var fn = this.generate2(method, clsName, sel);
        if (fn) {
            this.okCount++;
            method.compiled = fn;
            method.compiledLeaf = this.generateLeaf(method,
                ((clsName || "M") + "_" + (sel || "m")).replace(/[^a-zA-Z0-9_]/g, "ː")) || null;
            if (method.compiledLeaf) this.leafCount = (this.leafCount || 0) + 1;
        } else {
            this.bailCount++;
            method.compiledLeaf = null;
            return this.fallback.compile(method, optClassObj, optSelObj);
        }
    },
    enableSingleStepping: function(method, optClass, optSel) {
        // debugging always uses the jit1 debug/single-step generator
        return this.fallback.enableSingleStepping(method, optClass, optSel);
    },
},
'generating', {
    generateLeaf: function(method, funcName) {
        // Forma "leaf" de un método: función JS pura que recibe (vm, rcvr, args...)
        // y devuelve el resultado o Squeak.LEAF_DEOPT. Sin frame, sin zona, sin
        // alocaciones (el overflow aritmético deoptimiza — el restart re-ejecuta
        // el camino framed y ahí sí se aloca, exactamente una vez). Stores a inst
        // vars permitidos solo si no hay puntos de deopt posteriores (restart-safe:
        // los temps son locals JS, invisibles).
        if (method.methodPrimitiveIndex() !== 0) return null;
        var bytes = method.bytes;
        var numArgs = method.methodNumArgs();
        var tempCount = method.methodTempCount();
        var src = [];
        var depth = 0, maxDepth = 0;
        var pc = 0, endPC = 0;
        var labelDepth = {}, emitted = {};
        var knownDepth = true;
        var instStoreSeen = false, deoptSeen = false;
        var MIN = Squeak.MinSmallInt, MAX = Squeak.MaxSmallInt;
        function push(expr) { src.push("v" + depth + " = " + expr + ";\n"); depth++; if (depth > maxDepth) maxDepth = depth; }
        function pop() { depth--; return "v" + depth; }
        function top() { return "v" + (depth - 1); }
        function deopt() { deoptSeen = true; if (instStoreSeen) throw { bail: true }; return "return Squeak.LEAF_DEOPT;\n"; }
        function jumpTo(dest, atDepth) {
            if (dest <= pc) throw { bail: true }; // sin loops: trabajo acotado, sin interrupt checks
            if (labelDepth[dest] === undefined) labelDepth[dest] = atDepth;
            else if (labelDepth[dest] !== atDepth) throw { bail: true };
            if (dest > endPC) endPC = dest;
        }
        try {
            var done = false;
            while (!done) {
                var instStart = pc;
                if (!knownDepth) {
                    if (labelDepth[instStart] === undefined) throw { bail: true };
                    depth = labelDepth[instStart];
                    knownDepth = true;
                } else if (labelDepth[instStart] !== undefined && labelDepth[instStart] !== depth) {
                    throw { bail: true };
                }
                if (labelDepth[instStart] !== undefined) src.push("case " + instStart + ":\n");
                emitted[instStart] = depth;
                var b = bytes[pc++], b2;
                switch (b & 0xF8) {
                    case 0x00: case 0x08: push("inst[" + (b & 0xF) + "]"); break;
                    case 0x10: case 0x18: push("t" + (b & 0xF)); break;
                    case 0x20: case 0x28: case 0x30: case 0x38: push("lit[" + (1 + (b & 0x1F)) + "]"); break;
                    case 0x40: case 0x48: case 0x50: case 0x58: push("lit[" + (1 + (b & 0x1F)) + "].pointers[1]"); break;
                    case 0x60: // storeAndPop inst (receiver garantizado no-casado por el gate del call site)
                        if (deoptSeen) throw { bail: true }; // conservador: store tras posible deopt previo re-ejecutable? el restart re-ejecuta TODO: stores previos a deopts posteriores son el problema; deopts previos ya retornaron. Permitir.
                        instStoreSeen = true;
                        src.push("inst[" + (b & 7) + "] = " + pop() + "; rcvr.dirty = true;\n"); break;
                    case 0x68: src.push("t" + (b & 7) + " = " + pop() + ";\n"); break;
                    case 0x70:
                        switch (b) {
                            case 0x70: push("rcvr"); break;
                            case 0x71: push("vm.trueObj"); break;
                            case 0x72: push("vm.falseObj"); break;
                            case 0x73: push("vm.nilObj"); break;
                            case 0x74: push("-1"); break;
                            case 0x75: push("0"); break;
                            case 0x76: push("1"); break;
                            case 0x77: push("2"); break;
                        }
                        break;
                    case 0x78:
                        switch (b) {
                            case 0x78: src.push("return rcvr;\n"); break;
                            case 0x79: src.push("return vm.trueObj;\n"); break;
                            case 0x7A: src.push("return vm.falseObj;\n"); break;
                            case 0x7B: src.push("return vm.nilObj;\n"); break;
                            case 0x7C: src.push("return " + pop() + ";\n"); break;
                            default: throw { bail: true };
                        }
                        knownDepth = false;
                        done = pc > endPC;
                        break;
                    case 0x80: case 0x88:
                        switch (b) {
                            case 0x80:
                                b2 = bytes[pc++];
                                switch (b2 >> 6) {
                                    case 0: push("inst[" + (b2 & 0x3F) + "]"); break;
                                    case 1: push("t" + (b2 & 0x3F)); break;
                                    case 2: push("lit[" + (1 + (b2 & 0x3F)) + "]"); break;
                                    case 3: push("lit[" + (1 + (b2 & 0x3F)) + "].pointers[1]"); break;
                                }
                                break;
                            case 0x81:
                                b2 = bytes[pc++];
                                if ((b2 >> 6) === 1) { src.push("t" + (b2 & 0x3F) + " = " + top() + ";\n"); break; }
                                if ((b2 >> 6) === 0) { instStoreSeen = true; src.push("inst[" + (b2 & 0x3F) + "] = " + top() + "; rcvr.dirty = true;\n"); break; }
                                throw { bail: true };
                            case 0x82:
                                b2 = bytes[pc++];
                                if ((b2 >> 6) === 1) { src.push("t" + (b2 & 0x3F) + " = " + pop() + ";\n"); break; }
                                if ((b2 >> 6) === 0) { instStoreSeen = true; src.push("inst[" + (b2 & 0x3F) + "] = " + pop() + "; rcvr.dirty = true;\n"); break; }
                                throw { bail: true };
                            case 0x87: depth--; break;
                            case 0x88: push(top()); break;
                            default: throw { bail: true };
                        }
                        break;
                    case 0x90: { var d = (b & 7) + 1; jumpTo(pc + d, depth); src.push("{ pcx = " + (pc + d) + "; continue; }\n"); knownDepth = false; done = pc > endPC; break; }
                    case 0x98: { var d = (b & 7) + 1, dest = pc + d, c = pop();
                        jumpTo(dest, depth);
                        src.push("if (" + c + " === vm.falseObj) { pcx = " + dest + "; continue; }\n");
                        src.push("else if (" + c + " !== vm.trueObj) " + deopt());
                        break; }
                    case 0xA0: { b2 = bytes[pc++]; var d = ((b & 7) - 4) * 256 + b2; jumpTo(pc + d, depth); src.push("{ pcx = " + (pc + d) + "; continue; }\n"); knownDepth = false; done = pc > endPC; break; }
                    case 0xA8: { b2 = bytes[pc++]; var d = (b & 3) * 256 + b2, dest = pc + d, c = pop(), ifTrue = b < 0xAC;
                        jumpTo(dest, depth);
                        src.push("if (" + c + " === vm." + ifTrue + "Obj) { pcx = " + dest + "; continue; }\n");
                        src.push("else if (" + c + " !== vm." + !ifTrue + "Obj) " + deopt());
                        break; }
                    case 0xB0: case 0xB8: { // aritmética: smallint-in smallint-out, si no deopt
                        var op = b & 0xF, bb = pop(), aa = top();
                        var guard = "if (typeof " + aa + " !== 'number' || typeof " + bb + " !== 'number') " + deopt();
                        switch (op) {
                            case 0x0: case 0x1: {
                                var o = op === 0 ? "+" : "-";
                                src.push(guard);
                                src.push("var r" + depth + " = " + aa + " " + o + " " + bb + "; if (r" + depth + " < " + MIN + " || r" + depth + " > " + MAX + ") " + deopt());
                                src.push(aa + " = r" + depth + ";\n");
                                break;
                            }
                            case 0x2: case 0x3: case 0x4: case 0x5: {
                                var cmp = ["<", ">", "<=", ">="][op - 2];
                                src.push(guard);
                                src.push(aa + " = " + aa + " " + cmp + " " + bb + " ? vm.trueObj : vm.falseObj;\n");
                                break;
                            }
                            case 0x6: case 0x7: {
                                src.push(guard);
                                src.push(aa + " = " + aa + " " + (op === 6 ? "===" : "!==") + " " + bb + " ? vm.trueObj : vm.falseObj;\n");
                                break;
                            }
                            case 0xE: case 0xF: {
                                src.push(guard);
                                src.push(aa + " = " + aa + " " + (op === 0xE ? "&" : "|") + " " + bb + ";\n");
                                break;
                            }
                            default: throw { bail: true };
                        }
                        break;
                    }
                    case 0xC0: case 0xC8: {
                        var lo = b & 0xF;
                        if (lo === 0x6) { var b6 = pop(), a6 = top(); src.push(a6 + " = " + a6 + " === " + b6 + " ? vm.trueObj : vm.falseObj;\n"); break; }
                        if (lo === 0x7) { var t7 = top(); src.push(t7 + " = typeof " + t7 + " === 'number' ? vm.specialObjects[5] : " + t7 + ".sqClass;\n"); break; }
                        throw { bail: true };
                    }
                    default: throw { bail: true }; // sends reales, closures, thisContext: no-leaf
                }
            }
        } catch (e) {
            if (e && e.bail) return null;
            throw e;
        }
        // ensamblar
        var head = [];
        var params = ["vm", "rcvr"];
        for (var i = 0; i < numArgs; i++) params.push("t" + i);
        var decls = [];
        for (var i = numArgs; i < tempCount; i++) decls.push("t" + i + " = vm.nilObj");
        for (var i = 0; i < maxDepth; i++) decls.push("v" + i);
        head.push("'use strict';\nvar lit = arguments[0];\nreturn function LEAF_" + funcName + "(" + params.join(", ") + ") {\n");
        head.push("var inst = rcvr.pointers;\n");
        if (decls.length) head.push("var " + decls.join(", ") + ";\n");
        var hasLabels = Object.keys(labelDepth).length > 0;
        var body;
        if (hasLabels) {
            body = "var pcx = 0;\nwhile (true) switch (pcx) {\ncase 0:\n" + src.join("") + "default: return Squeak.LEAF_DEOPT;\n}\n";
        } else {
            body = src.join("") + "return Squeak.LEAF_DEOPT;\n";
        }
        // lit se pasa via bind para no leer method.pointers por llamada
        var full = head.join("") + body + "}";
        try {
            return new Function(full)(method.pointers); // literales cerrados en la función
        } catch (e) {
            return null;
        }
    },
    generate2: function(method, optClass, optSel) {
        try {
            return this.generateV3R(method, optClass, optSel);
        } catch (e) {
            if (e && e.bail) return null;
            throw e;
        }
    },
    envNo: function(tag) {
        return typeof process !== "undefined" && process.env && process.env.JIT2NO
            && process.env.JIT2NO.split(",").indexOf(tag) >= 0;
    },
    bail: function(why) {
        throw { bail: true, why: why };
    },
    generateV3R: function(method, optClass, optSel) {
        this.method = method;
        this.pc = 0;
        this.endPC = 0;
        this.depth = 0;          // virtual operand-stack depth
        this.maxDepth = 0;
        this.knownDepth = true;  // false after unconditional jump/return until a label
        this.labelDepth = {};    // pc -> expected depth (from forward jumps / resumes)
        this.resumeDepth = {};   // pc -> depth to reload on trampoline re-entry
        this.needsLabel = {};
        this.sourceParts = [];   // list of {pc, code:[]} segments, one per instruction
        this.ics = [];
        var tempCount = method.methodTempCount();
        this.tempCount = tempCount;
        this.blockRegions = []; // {from, to, ceil}: dentro de un block V3, los temps
                                // con índice >= args+copied ALIASAN slots del stack de
                                // operandos (los aloca el pushNil inicial del block);
                                // jit2 los tiene en locals, así que esos métodos bailean
        // pass over bytecodes
        this.done = false;
        while (!this.done) {
            this.instStart = this.pc;
            this.beginInstruction();
            var b = method.bytes[this.pc++];
            this.generateByte(b);
        }
        // assemble
        var parts = this.sourceParts;
        var src = [];
        var maxD = this.maxDepth;
        var decl = [];
        for (var i = 0; i < maxD; i++) decl.push("s" + i);
        src.push("var zone = vm.stack, fp = vm.fp, page = vm.zonePage;\n");
        src.push("var rcvr = vm.receiver, inst = rcvr.pointers, lit = vm.method.pointers;\n");
        // spBase = base del stack de operandos de ESTA activación (métodos y
        // blocks difieren); en entrada fresca depth=0 así que spBase = vm.sp,
        // en re-entrada el prelude del label lo deriva de la depth de resume
        src.push("var tB = vm.tempOffset, spBase = vm.sp;\n");
        if (decl.length) src.push("var ", decl.join(", "), ";\n");
        src.push("var entering = true;\n");
        src.push("while (true) switch (vm.pc) {\n");
        this.needsLabel[0] = true;
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (this.needsLabel[part.pc]) {
                src.push("case ", part.pc, ":\n");
                // profundidad a recargar: la depth estática de este label —
                // cubre resumes de sends Y transiciones intérprete->compilado
                // a mitad de método (loop heads con contador en el stack)
                var rd = this.emittedDepth[part.pc] || 0;
                src.push("if (entering) { entering = false; spBase = vm.sp - ", rd, ";");
                for (var k = 0; k < rd; k++)
                    src.push(" s", k, " = zone[spBase + ", 1 + k, "];");
                src.push(" }\n");
            }
            for (var j = 0; j < part.code.length; j++) src.push(part.code[j]);
        }
        src.push("default: if (vm.jit2Debug) { console.error('jit2 default pc=' + vm.pc + ' mbytes=' + vm.method.bytes.length); console.error('bytes: ' + Array.prototype.join.call(vm.method.bytes, ',')); console.error(String(vm.method.compiled).slice(0, 2000)); vm.jit2Debug = false; } vm.interpretOne(true); return;\n}");
        var funcName = (optClass && optSel)
            ? (optClass + "_" + optSel).replace(/[^a-zA-Z0-9_]/g, "ː")
            : "R_METHOD";
        var body = "'use strict';\nvar ics = arguments[0];\nreturn function " + funcName
            + "(vm) {\n" + src.join("") + "}";
        try {
            return new Function(body)(this.ics);
        } catch (e) {
            this.bail("syntax: " + e.message);
        }
    },
    beginInstruction: function() {
        // labels: if this pc is a known jump target, depths must agree
        var expected = this.labelDepth[this.instStart];
        if (!this.knownDepth) {
            if (expected === undefined) this.bail("unreachable code with unknown depth");
            this.depth = expected;
            this.knownDepth = true;
        } else if (expected !== undefined && expected !== this.depth) {
            this.bail("stack depth mismatch at label");
        }
        if (!this.emittedDepth) this.emittedDepth = {};
        this.emittedDepth[this.instStart] = this.depth;
        this.part = { pc: this.instStart, code: [] };
        this.sourceParts.push(this.part);
    },
    emit: function(/* ... */) {
        for (var i = 0; i < arguments.length; i++) this.part.code.push(arguments[i]);
    },
    push: function(expr) {
        this.emit("s", this.depth, " = ", expr, ";\n");
        this.depth++;
        if (this.depth > this.maxDepth) this.maxDepth = this.depth;
    },
    top: function() { return "s" + (this.depth - 1); },
    pop: function() { this.depth--; return "s" + this.depth; },
    slotAt: function(depthFromTop) { return "s" + (this.depth - 1 - depthFromTop); },
    checkTempAccess: function(index) {
        // buscar la región de block MÁS INTERNA que contenga el pc actual
        for (var i = this.blockRegions.length - 1; i >= 0; i--) {
            var r = this.blockRegions[i];
            if (this.instStart >= r.from && this.instStart < r.to) {
                if (index >= r.ceil) this.bail("block stack-temp aliasing");
                return;
            }
        }
    },
    spillAll: function() {
        for (var k = 0; k < this.depth; k++)
            this.emit("zone[spBase + ", 1 + k, "] = s", k, ";\n");
        this.emit("vm.sp = spBase + ", this.depth, ";\n");
    },
    activationCheck: function() {
        return "if (vm.fp !== fp || vm.zonePage !== page || vm.breakOutOfInterpreter !== false) return;\n";
    },
    markJumpTarget: function(dest) {
        this.needsLabel[dest] = true;
        if (dest > this.endPC) this.endPC = dest;
        if (dest <= this.instStart) { // backward: el label ya se emitió
            if (this.emittedDepth[dest] !== this.depth) this.bail("backward jump depth mismatch");
            return;
        }
        var expected = this.labelDepth[dest];
        if (expected === undefined) this.labelDepth[dest] = this.depth;
        else if (expected !== this.depth) this.bail("jump depth mismatch");
    },
    markResume: function(pc, depthAfter) {
        this.needsLabel[pc] = true;
        if (pc > this.endPC) this.endPC = pc; // el label de resume debe generarse
        if (this.resumeDepth[pc] !== undefined && this.resumeDepth[pc] !== depthAfter)
            this.bail("conflicting resume depths");
        this.resumeDepth[pc] = depthAfter;
        if (pc <= this.instStart) { // backward (interrupt check de back-jump)
            if (this.emittedDepth[pc] !== depthAfter) this.bail("backward resume depth mismatch");
            return;
        }
        var expected = this.labelDepth[pc];
        if (expected === undefined) this.labelDepth[pc] = depthAfter;
        else if (expected !== depthAfter) this.bail("resume depth mismatch");
    },
    endOfSegment: function() {
        // after return/unconditional jump: depth unknown until next label
        this.knownDepth = false;
        this.done = this.pc > this.endPC;
    },
},
'bytecodes', {
    generateByte: function(byte) {
        var b2, b3;
        switch (byte & 0xF8) {
            case 0x00: case 0x08: // push inst var
                this.push("inst[" + (byte & 0x0F) + "]"); break;
            case 0x10: case 0x18: // push temp
                this.checkTempAccess(byte & 0xF);
                this.push("zone[tB + " + (byte & 0xF) + "]"); break;
            case 0x20: case 0x28: case 0x30: case 0x38: // push literal
                this.push("lit[" + (1 + (byte & 0x1F)) + "]"); break;
            case 0x40: case 0x48: case 0x50: case 0x58: // push literal indirect
                this.push("lit[" + (1 + (byte & 0x1F)) + "].pointers[1]"); break;
            case 0x60: // storeAndPop inst var
                this.generateStoreInst(byte & 7, true); break;
            case 0x68: // storeAndPop temp
                this.checkTempAccess(byte & 7);
                this.emit("zone[tB + ", byte & 7, "] = ", this.pop(), ";\n"); break;
            case 0x70: // quick pushes
                switch (byte) {
                    case 0x70: this.push("rcvr"); break;
                    case 0x71: this.push("vm.trueObj"); break;
                    case 0x72: this.push("vm.falseObj"); break;
                    case 0x73: this.push("vm.nilObj"); break;
                    case 0x74: this.push("-1"); break;
                    case 0x75: this.push("0"); break;
                    case 0x76: this.push("1"); break;
                    case 0x77: this.push("2"); break;
                }
                break;
            case 0x78: // quick returns
                switch (byte) {
                    case 0x78: this.generateReturn("rcvr"); break;
                    case 0x79: this.generateReturn("vm.trueObj"); break;
                    case 0x7A: this.generateReturn("vm.falseObj"); break;
                    case 0x7B: this.generateReturn("vm.nilObj"); break;
                    case 0x7C: this.generateReturn(this.pop()); break;
                    case 0x7D: this.generateBlockReturn(); break;
                    default: this.bail("unusedBytecode " + byte);
                }
                break;
            case 0x80: case 0x88:
                this.generateExtended(byte); break;
            case 0x90: // short jump
                this.generateJump((byte & 7) + 1); break;
            case 0x98: // short conditional jump (jumpIfFalse)
                this.generateJumpIf(false, (byte & 7) + 1); break;
            case 0xA0: // long jump
                b2 = this.method.bytes[this.pc++];
                this.generateJump(((byte & 7) - 4) * 256 + b2); break;
            case 0xA8: // long conditional jump
                b2 = this.method.bytes[this.pc++];
                this.generateJumpIf(byte < 0xAC, (byte & 3) * 256 + b2); break;
            case 0xB0: case 0xB8: // arithmetic special sends
                this.generateNumericOp(byte); break;
            case 0xC0: case 0xC8: // quick prims
                this.generateQuickPrim(byte); break;
            case 0xD0: case 0xD8: // send literal selector, 0 args
                this.generateSend(1 + (byte & 0xF), 0); break;
            case 0xE0: case 0xE8: // 1 arg
                this.generateSend(1 + (byte & 0xF), 1); break;
            case 0xF0: case 0xF8: // 2 args
                this.generateSend(1 + (byte & 0xF), 2); break;
            default: this.bail("bytecode " + byte);
        }
    },
    generateExtended: function(byte) {
        var b2, b3;
        switch (byte) {
            case 0x80: // extended push
                b2 = this.method.bytes[this.pc++];
                switch (b2 >> 6) {
                    case 0: this.push("inst[" + (b2 & 0x3F) + "]"); break;
                    case 1: this.checkTempAccess(b2 & 0x3F); this.push("zone[tB + " + (b2 & 0x3F) + "]"); break;
                    case 2: this.push("lit[" + (1 + (b2 & 0x3F)) + "]"); break;
                    case 3: this.push("lit[" + (1 + (b2 & 0x3F)) + "].pointers[1]"); break;
                }
                break;
            case 0x81: // extended store (no pop)
                b2 = this.method.bytes[this.pc++];
                switch (b2 >> 6) {
                    case 0: this.generateStoreInst(b2 & 0x3F, false); break;
                    case 1: this.checkTempAccess(b2 & 0x3F); this.emit("zone[tB + ", b2 & 0x3F, "] = ", this.top(), ";\n"); break;
                    case 2: this.bail("store into literal");
                    case 3: this.emit("var assoc = lit[", 1 + (b2 & 0x3F), "]; assoc.dirty = true; assoc.pointers[1] = ", this.top(), ";\n"); break;
                }
                break;
            case 0x82: // extended store-pop
                b2 = this.method.bytes[this.pc++];
                switch (b2 >> 6) {
                    case 0: this.generateStoreInst(b2 & 0x3F, true); break;
                    case 1: this.checkTempAccess(b2 & 0x3F); this.emit("zone[tB + ", b2 & 0x3F, "] = ", this.pop(), ";\n"); break;
                    case 2: this.bail("store into literal");
                    case 3: this.emit("var assoc = lit[", 1 + (b2 & 0x3F), "]; assoc.dirty = true; assoc.pointers[1] = ", this.pop(), ";\n"); break;
                }
                break;
            case 0x83: // single extended send
                b2 = this.method.bytes[this.pc++];
                this.generateSend(1 + (b2 & 31), b2 >> 5);
                break;
            case 0x84: // double extended do-anything
                b2 = this.method.bytes[this.pc++];
                b3 = this.method.bytes[this.pc++];
                switch (b2 >> 5) {
                    case 0: this.generateSend(1 + b3, b2 & 31); break;
                    case 1: if (this.envNo("super")) this.bail("super"); this.generateSend(1 + b3, b2 & 31, true); break;
                    case 2: this.push("inst[" + b3 + "]"); break;
                    case 3: this.push("lit[" + (1 + b3) + "]"); break;
                    case 4: this.push("lit[" + (1 + b3) + "].pointers[1]"); break;
                    default: this.bail("doubleExtended op " + (b2 >> 5));
                }
                break;
            case 0x85: // single extended send to super
                if (this.envNo("super")) this.bail("super");
                b2 = this.method.bytes[this.pc++];
                this.generateSend(1 + (b2 & 31), b2 >> 5, true);
                break;
            case 0x86: // second extended send
                if (this.envNo("send2")) this.bail("send2");
                b2 = this.method.bytes[this.pc++];
                this.generateSend(1 + (b2 & 0x3F), b2 >> 6);
                break;
            case 0x87: // pop
                this.depth--; break;
            case 0x88: // dup
                this.push(this.top()); break;
            case 0x89: // thisContext
                this.spillAll();
                this.push("vm.exportThisContext()");
                break;
            case 0x8A: { // closure temps (array de indirección)
                if (this.envNo("ctemps")) this.bail("ctemps");
                b2 = this.method.bytes[this.pc++];
                var popValues = b2 > 127, count = b2 & 127;
                this.emit("var arr = vm.instantiateClass(vm.specialObjects[7], ", count, ");\n");
                if (popValues) {
                    for (var ci = 0; ci < count; ci++)
                        this.emit("arr.pointers[", ci, "] = ", this.slotAt(count - ci - 1), ";\n");
                    this.depth -= count;
                }
                this.push("arr");
                break;
            }
            case 0x8C:
                if (this.envNo("vec")) this.bail("vec");
                // remote push from temp vector
                b2 = this.method.bytes[this.pc++];
                b3 = this.method.bytes[this.pc++];
                this.push("zone[tB + " + b3 + "].pointers[" + b2 + "]");
                break;
            case 0x8D: { // remote store into temp vector
                if (this.envNo("vec")) this.bail("vec");
                b2 = this.method.bytes[this.pc++];
                b3 = this.method.bytes[this.pc++];
                this.emit("var tv = zone[tB + ", b3, "]; tv.pointers[", b2, "] = ", this.top(), "; tv.dirty = true;\n");
                break;
            }
            case 0x8E: { // remote store and pop
                if (this.envNo("vec")) this.bail("vec");
                b2 = this.method.bytes[this.pc++];
                b3 = this.method.bytes[this.pc++];
                this.emit("var tv = zone[tB + ", b3, "]; tv.pointers[", b2, "] = ", this.pop(), "; tv.dirty = true;\n");
                break;
            }
            case 0x8F: // pushClosureCopy
                this.generateClosureCopy(); break;
            default:
                this.bail("extended " + byte); // 0x8B callPrimitive: jit1
        }
    },
    generateStoreInst: function(index, popIt) {
        var val = popIt ? this.pop() : this.top();
        // married-context write-through, same protocol as jit1 frames templates
        this.emit("if (rcvr.sqClass !== vm.contextClass_ || rcvr.frame == null) { inst[", index, "] = ", val, "; rcvr.dirty = true; }\n");
        this.emit("else { ");
        this.spillAll();
        this.emit("vm.pc = ", this.pc, "; vm.storeToMarriedContext(rcvr, ", index, ", ", val, "); ",
            this.activationCheck(), " }\n");
        this.markResume(this.pc, this.depth);
    },
    generateReturn: function(what) {
        this.emit("vm.pc = ", this.pc, "; vm.doReturn(", what, "); return;\n");
        this.endOfSegment();
    },
    generateBlockReturn: function() {
        this.emit("vm.pc = ", this.pc, "; vm.doBlockReturn(", this.pop(), "); return;\n");
        this.endOfSegment();
    },
    generateJump: function(distance) {
        var dest = this.pc + distance;
        if (distance < 0) {
            // backward jump: interrupt check; a process switch must find the
            // frame resumable, so spill live slots (loop back-edges: usually 0)
            this.spillAll();
            this.emit("if (vm.interruptCheckCounter-- <= 0) {\n",
                "  vm.pc = ", dest, "; vm.checkForInterrupts();\n",
                "  ", this.activationCheck(), "}\n");
            this.markResume(dest, this.depth);
        }
        this.markJumpTarget(dest);
        this.emit("vm.pc = ", dest, "; continue;\n");
        this.endOfSegment();
    },
    generateJumpIf: function(condition, distance) {
        var dest = this.pc + distance;
        var cond = this.pop();
        this.emit("if (", cond, " === vm.", condition, "Obj) { vm.pc = ", dest, "; continue; }\n");
        this.emit("else if (", cond, " !== vm.", !condition, "Obj) {\n");
        this.depth++; this.spillAll(); this.depth--; // cond back on stack as receiver
        this.emit("  vm.pc = ", this.pc, "; vm.send(vm.specialObjects[25], 0, false); return; }\n");
        this.markJumpTarget(dest);
        this.markResume(this.pc, this.depth);
    },
    generateSend: function(litIndex, argCount, superFlag) {
        var ic = this.ics.length;
        this.ics.push({ c: null, m: null, a: 0, p: 0, k: null });
        var rcvrSlot = this.slotAt(argCount);
        var argSlots = [];
        for (var i = argCount - 1; i >= 0; i--) argSlots.push(this.slotAt(i));
        this.emit("vm.pc = ", this.pc, ";\n");
        this.emit("var ic = ics[", ic, "], rc = typeof ", rcvrSlot, " === 'number' ? vm.smallIntClass_ : ", rcvrSlot, ".sqClass;\n");
        if (superFlag) {
            // super: la clase de lookup es estática (superclase de la clase del
            // método) — el IC se llena una sola vez y vale para todo receiver
            this.emit("if (ic.c === null) vm.jit2FillSuperIC(ic, lit[", litIndex, "], ", argCount, ");\n");
        } else {
            this.emit("if (rc !== ic.c) vm.jit2FillIC(ic, lit[", litIndex, "], ", argCount, ", rc);\n");
        }
        // leaf fast path: sin spill, sin frame, args como argumentos JS. Solo con
        // interruptCheckCounter > 0 (paridad exacta de cadencia con el golden:
        // vencido => camino framed, donde executeNewMethod chequea como siempre)
        this.emit("var lr = vm.LEAF_DEOPT_;\n");
        this.emit("if (ic.a === ", argCount, " && ic.m.compiledLeaf != null && rc !== vm.contextClass_ && vm.interruptCheckCounter > 0) {\n");
        this.emit("  var sc = vm.sendCount++; vm.interruptCheckCounter--;\n");
        this.emit("  lr = ic.m.compiledLeaf(vm, ", [rcvrSlot].concat(argSlots).join(", "), ");\n");
        this.emit("  if (lr === vm.LEAF_DEOPT_) { vm.sendCount--; vm.interruptCheckCounter++; vm.nLeafDeopts++; }\n");
        this.emit("  else { vm.nLeafCalls++; if (vm.jit2LeafHook) vm.jit2LeafHook(ic.m, sc, ", rcvrSlot, ", lit[", litIndex, "]); }\n");
        this.emit("}\n");
        var resultSlot = "s" + (this.depth - argCount - 1);
        this.emit("if (lr !== vm.LEAF_DEOPT_) { ", resultSlot, " = lr; }\n");
        this.emit("else {\n");
        this.spillAll();
        this.emit("if (rc === vm.contextClass_ && ", rcvrSlot, ".frame != null) vm.syncMarriedContext(", rcvrSlot, ");\n");
        this.emit("if (ic.p) { vm.verifyAtSelector = lit[", litIndex, "]; vm.verifyAtClass = ", superFlag ? "ic.c" : "rc", "; }\n");
        this.emit("vm.executeNewMethod(", rcvrSlot, ", ic.m, ic.a, ic.p, ic.k, lit[", litIndex, "]);\n");
        this.emit(this.activationCheck());
        this.emit(resultSlot, " = zone[vm.sp];\n");
        this.emit("}\n");
        this.depth -= argCount + 1;
        this.depth++; if (this.depth > this.maxDepth) this.maxDepth = this.depth;
        this.markResume(this.pc, this.depth);
    },
    generateNumericOp: function(byte) {
        var a, b;
        switch (byte & 0xF) {
            case 0x0: case 0x1: { // + -
                var op = (byte & 0xF) === 0 ? "+" : "-";
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number') ",
                    a, " = vm.primHandler.signed32BitIntegerFor(", a, " ", op, " ", b, ");\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            case 0x2: case 0x3: case 0x4: case 0x5: { // < > <= >=
                var cmp = ["<", ">", "<=", ">="][(byte & 0xF) - 2];
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number') ",
                    a, " = ", a, " ", cmp, " ", b, " ? vm.trueObj : vm.falseObj;\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            case 0x6: case 0x7: { // = ~=
                var eq = (byte & 0xF) === 6;
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number') ",
                    a, " = ", a, " ", eq ? "===" : "!==", " ", b, " ? vm.trueObj : vm.falseObj;\n");
                this.emit("else if (", a, " === ", b, " && ", a, ".float === ", a, ".float) ",
                    a, " = vm.", eq ? "true" : "false", "Obj;\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            case 0xE: case 0xF: { // bitAnd: bitOr:
                var bop = (byte & 0xF) === 0xE ? "&" : "|";
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number' && (", a, "|0) === ", a, " && (", b, "|0) === ", b, ") ",
                    a, " = ", a, " ", bop, " ", b, ";\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            default: { // * / \\ @ bitShift: // : usar el camino genérico de vm
                b = this.pop(); a = this.top();
                this.generateNumericSlow(byte & 0xF);
                break;
            }
        }
    },
    generateNumericFallback: function(a, b, opIndex) {
        // a/b son locals; a ya tiene el resultado si el fast path aplicó.
        // Si no aplicó, mandar el send especial (stack: rcvr, arg).
        this.emit("else {\n");
        this.depth++; this.spillAll(); this.depth--;
        this.emit("  vm.pc = ", this.pc, "; vm.sendSpecial(", opIndex, "); ", this.activationCheck());
        this.emit("  ", a, " = zone[vm.sp];\n}\n");
        this.markResume(this.pc, this.depth);
    },
    generateNumericSlow: function(opIndex) {
        // sin fast path inline: siempre via camino del vm (pop2AndPush... via sendSpecial-like)
        this.depth++; this.spillAll(); this.depth--;
        var a = "s" + (this.depth - 1);
        this.emit("vm.pc = ", this.pc, "; vm.sp = spBase + ", this.depth + 1, ";\n");
        // replicar jit1: success+pop2AndPush<X>Result según op
        switch (opIndex) {
            case 0x8: this.emit("vm.success = true; vm.resultIsFloat = false; if (!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) * vm.stackIntOrFloat(0))) { vm.sendSpecial(8); ", this.activationCheck(), "}\n"); break;
            case 0x9: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.quickDivide(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(9); ", this.activationCheck(), "}\n"); break;
            case 0xA: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.mod(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(10); ", this.activationCheck(), "}\n"); break;
            case 0xB: this.emit("vm.success = true; if (!vm.primHandler.primitiveMakePoint(1, true)) { vm.sendSpecial(11); ", this.activationCheck(), "}\n"); break;
            case 0xC: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.safeShift(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(12); ", this.activationCheck(), "}\n"); break;
            case 0xD: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.div(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(13); ", this.activationCheck(), "}\n"); break;
            default: this.bail("numeric op " + opIndex);
        }
        this.emit(a, " = zone[vm.sp];\n");
        this.markResume(this.pc, this.depth);
    },
    generateQuickPrim: function(byte) {
        var lo = byte & 0xF;
        switch (lo) {
            case 0x6: { // ==
                var b = this.pop(), a = this.top();
                this.emit(a, " = ", a, " === ", b, " ? vm.trueObj : vm.falseObj;\n");
                return;
            }
            case 0x7: { // class
                var t = this.top();
                this.emit(t, " = typeof ", t, " === 'number' ? vm.specialObjects[5] : ", t, ".sqClass;\n");
                return;
            }
            case 0x0: { // at:
                var idx = this.slotAt(0), arr = this.slotAt(1);
                this.emit("if (", arr, ".sqClass === vm.specialObjects[7] && ", arr, ".pointers && typeof ", idx, " === 'number' && ", idx, " > 0 && ", idx, " <= ", arr, ".pointers.length) {\n",
                    "  ", arr, " = ", arr, ".pointers[", idx, " - 1];\n} else {\n");
                this.spillAll();
                this.emit("  var c = vm.primHandler.objectAt(true,true,false); if (vm.primHandler.success) { vm.sp -= 1; ", arr, " = c; } else {\n",
                    "  vm.pc = ", this.pc, "; vm.sendSpecial(16); ", this.activationCheck(),
                    "  ", arr, " = zone[vm.sp]; }\n}\n");
                this.depth--;
                this.markResume(this.pc, this.depth);
                return;
            }
            case 0x1: { // at:put:
                var val = this.slotAt(0), idx = this.slotAt(1), arr = this.slotAt(2);
                this.emit("if (", arr, ".sqClass === vm.specialObjects[7] && ", arr, ".pointers && typeof ", idx, " === 'number' && ", idx, " > 0 && ", idx, " <= ", arr, ".pointers.length) {\n",
                    "  ", arr, ".pointers[", idx, " - 1] = ", val, "; ", arr, ".dirty = true; ", arr, " = ", val, ";\n} else {\n");
                this.spillAll();
                // puede flushear (context casado): pc de re-ejecución idempotente
                this.emit("  vm.pc = ", this.instStart, "; vm.primHandler.objectAtPut(true,true,false); if (vm.fp !== fp || vm.zonePage !== page) return;\n",
                    "  if (vm.primHandler.success) { vm.sp -= 2; ", arr, " = ", val, "; } else {\n",
                    "  vm.pc = ", this.pc, "; vm.sendSpecial(17); ", this.activationCheck(),
                    "  ", arr, " = zone[vm.sp]; }\n}\n");
                this.depth -= 2;
                this.needsLabel[this.instStart] = true;
                this.labelDepth[this.instStart] = this.depth + 2;
                this.resumeDepth[this.instStart] = this.depth + 2;
                this.markResume(this.pc, this.depth);
                return;
            }
            case 0x2: { // size
                var t = this.top();
                this.emit("if (", t, ".sqClass === vm.specialObjects[7]) ", t, " = ", t, ".pointersSize();\n",
                    "else if (", t, ".sqClass === vm.specialObjects[6]) ", t, " = ", t, ".bytesSize();\n",
                    "else {\n");
                this.spillAll();
                this.emit("  vm.pc = ", this.pc, "; vm.sendSpecial(18); ", this.activationCheck(),
                    "  ", t, " = zone[vm.sp];\n}\n");
                this.markResume(this.pc, this.depth);
                return;
            }
            case 0x9: case 0xA: case 0xB: { // value value: do:
                this.spillAll();
                var rcvrSlot = this.slotAt(lo === 0x9 ? 0 : 1);
                this.emit("vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(", rcvrSlot, ", ", lo, ")) vm.sendSpecial(", lo + 16, "); return;\n");
                this.depth -= (lo === 0x9 ? 0 : 1);
                this.markResume(this.pc, this.depth);
                this.endOfSegment();
                // tras el return el resultado queda en zone: el resume lo recarga
                return;
            }
            case 0x3: case 0x5: case 0xC: case 0xE: case 0xF: { // next atEnd new x y (0 args)
                if (this.envNo("qp0")) this.bail("qp0");
                this.spillAll(); // receiver ya está en el stack virtual
                this.emit("vm.primHandler.success = true; vm.pc = ", this.pc, "; vm.sendSpecial(", lo + 16, "); ", this.activationCheck());
                this.emit(this.top(), " = zone[vm.sp];\n");
                this.markResume(this.pc, this.depth);
                return;
            }
            case 0x4: case 0xD: { // nextPut: new: (1 arg)
                if (this.envNo("qp1")) this.bail("qp1");
                this.spillAll();
                this.emit("vm.primHandler.success = true; vm.pc = ", this.pc, "; vm.sendSpecial(", lo + 16, "); ", this.activationCheck());
                this.depth--;
                this.emit(this.top(), " = zone[vm.sp];\n");
                this.markResume(this.pc, this.depth);
                return;
            }
            default: // blockCopy: do: -> jit1
                this.bail("quick prim " + lo);
        }
    },
    generateClosureCopy: function() {
        var b = this.method.bytes;
        var numArgsNumCopied = b[this.pc++],
            numArgs = numArgsNumCopied & 0xF,
            numCopied = numArgsNumCopied >> 4,
            blockSize = b[this.pc++] * 256 + b[this.pc++];
        var from = this.pc, to = from + blockSize;
        this.blockRegions.push({ from: from, to: to, ceil: numArgs + numCopied });
        // marry del frame activo: la zona y vm.sp deben reflejar el estado real
        // (el snapshot del context casado y el GC leen vm.sp)
        this.spillAll();
        this.emit("var closure = vm.instantiateClass(vm.specialObjects[36], ", numCopied, ");\n");
        this.emit("closure.pointers[0] = vm.activeContextObj(); vm.reclaimableContextCount = 0;\n");
        this.emit("closure.pointers[1] = ", from + this.method.pointers.length * 4 + 1, ";\n");
        this.emit("closure.pointers[2] = ", numArgs, ";\n");
        for (var i = 0; i < numCopied; i++)
            this.emit("closure.pointers[", 3 + i, "] = ", this.slotAt(numCopied - i - 1), ";\n");
        this.depth -= numCopied;
        this.push("closure");
        this.emit("vm.pc = ", to, "; continue;\n");
        this.markJumpTarget(to);
        // el cuerpo del block arranca con stack vacío (activación fresca)
        this.needsLabel[from] = true;
        this.labelDepth[from] = 0;
        this.resumeDepth[from] = 0;
        if (to > this.endPC) this.endPC = to;
        this.endOfSegment();
    },
});

// vm-side support
Object.extend(Squeak.Interpreter.prototype, 'jit2 support', {
    jit2FillSuperIC: function(ic, selector, argCount) {
        // super: lookup estático en la superclase de la clase del método activo
        var lookupClass = this.method.methodClassForSuper().superclass();
        this.jit2FillIC(ic, selector, argCount, lookupClass);
    },
    jit2FillIC: function(ic, selector, argCount, lookupClass) {
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        ic.c = lookupClass;
        ic.m = entry.method;
        ic.a = entry.argCount;
        ic.p = entry.primIndex;
        ic.k = entry.mClass;
    },
});
