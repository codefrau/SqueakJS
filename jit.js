"use strict";
/*
 * Copyright (c) 2014-2020 Vanessa Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

Object.subclass('Squeak.Compiler',

/****************************************************************************

VM and Compiler
===============

The VM has an interpreter, it will work fine (and much more memory-efficient)
without loading a compiler. The compiler plugs into the VM by providing the
Squeak.Compiler global. It can be easily replaced by just loading a different
script providing Squeak.Compiler.

The VM creates the compiler instance after an image has been loaded and the VM
been initialized. Whenever a method is activated that was not compiled yet, the
compiler gets a chance to compile it. The compiler may decide to wait for a couple
of activations before actually compiling it. This might prevent do-its from ever
getting compiled, because they are only activated once. Therefore, the compiler
is also called when a long-running non-optimized loop calls checkForInterrupts.
Finally, whenever the interpreter is about to execute a bytecode, it calls the
compiled method instead (which typically will execute many bytecodes):

    initialize:
        compiler = new Squeak.Compiler(vm);

    executeNewMethod, checkForInterrupts:
        if (!method.compiled && compiler)
            compiler.compile(method);

    interpret:
        if (method.compiled) method.compiled(vm);

Note that a compiler could hook itself into a compiled method by dispatching
to vm.compiler in the generated code. This would allow gathering statistics,
recompiling with optimized code etc.


About This Compiler
===================

The compiler in this file is meant to be simple, fast-compiling, and general.
It transcribes bytecodes 1-to-1 into equivalent JavaScript code using
templates (and thus can even support single-stepping). It uses the
interpreter's stack pointer (SP) and program counter (PC), actual context
objects just like the interpreter, no register mapping, it does not optimize
sends, etc.

Jumps are handled by wrapping the whole method in a loop and switch. This also
enables continuing in the middle of a compiled method: whenever another context
is activated, the method returns to the main loop, and is entered again later
with a different PC. Here is an example method, its bytecodes, and a simplified
version of the generated JavaScript code:

    method
        [value selector] whileFalse.
        ^ 42

    0 <00> pushInstVar: 0
    1 <D0> send: #selector
    2 <A8 02> jumpIfTrue: 6
    4 <A3 FA> jumpTo: 0
    6 <21> pushConst: 42
    7 <7C> return: topOfStack

    context = vm.activeContext
    while (true) switch (vm.pc) {
    case 0:
        stack[++vm.sp] = inst[0];
        vm.pc = 2; vm.send(#selector); // activate new method
        return; // return to main loop
        // Main loop will execute the activated method. When
        // that method returns, this method will be called
        // again with vm.pc == 2 and jump directly to case 2
    case 2:
        if (stack[vm.sp--] === vm.trueObj) {
            vm.pc = 6;
            continue; // jump to case 6
        }
        // otherwise fall through to next case
    case 4:
        vm.pc = 0;
        continue; // jump to case 0
    case 6:
        stack[++vm.sp] = 42;
        vm.pc = 7; vm.doReturn(stack[vm.sp]);
        return;
    }

Debugging support
=================

This compiler supports generating single-stepping code and comments, which are
rather helpful during debugging.

Normally, only bytecodes that can be a jump target are given a label. Also,
bytecodes following a send operation need a label, to enable returning to that
spot after the context switch. All other bytecodes are executed continuously.

When compiling for single-stepping, each bytecode gets a label, and after each
bytecode a flag is checked and the method returns if needed. Because this is
a performance penalty, methods are first compiled without single-step support,
and recompiled for single-stepping on demand.

This is optional, another compiler can answer false from enableSingleStepping().
In that case the VM will delete the compiled method and invoke the interpreter
to single-step.

*****************************************************************************/

'initialization', {
    initialize: function(vm) {
        if (vm.method.methodSignFlag() && !Squeak.sistaJIT) {
            console.warn("Sista bytecode set not (yet) supported by this JIT");
            return {};
        }
        this.vm = vm;
        this.comments = !!Squeak.Compiler.comments, // generate comments
        // for debug-printing only
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
        this.doitCounter = 0;
    },
},
'accessing', {
    compile: function(method, optClass, optSel) {
        if (method.methodSignFlag() && !Squeak.sistaJIT) {
            return; // Sista JIT still experimental
        } else if (method.compiled === undefined) {
            // 1st time
            method.compiled = false;
        } else {
            // 2nd time
            this.singleStep = false;
            this.debug = this.comments;
            var clsName = optClass && optClass.className(),
                sel = optSel && optSel.bytesAsString();
            method.compiled = this.generate(method, clsName, sel);
        }
    },
    enableSingleStepping: function(method, optClass, optSel) {
        // recompile method for single-stepping
        if (!method.compiled || !method.compiled.canSingleStep) {
            this.singleStep = true; // generate breakpoint support
            this.debug = true;
            if (!optClass) {
                this.vm.allMethodsDo(function(classObj, methodObj, selectorObj) {
                    if (methodObj === method) {
                        optClass = classObj;
                        optSel = selectorObj;
                        return true;
                    }
                });
            }
            var cls = optClass && optClass.className();
            var sel = optSel && optSel.bytesAsString();
            var instVars = optClass && optClass.allInstVarNames();
            method.compiled = this.generate(method, cls, sel, instVars);
            method.compiled.canSingleStep = true;
        }
        // if a compiler does not support single-stepping, return false
        return true;
    },
    functionNameFor: function(cls, sel) {
        if (cls === undefined || cls === '?') return "DOIT_" + ++this.doitCounter;
        if (!/[^a-zA-Z0-9:_]/.test(sel))
            return (cls + "_" + sel).replace(/[: ]/g, "_");
        var op = sel.replace(/./g, function(char) {
            var repl = {'|': "OR", '~': "NOT", '<': "LT", '=': "EQ", '>': "GT",
                    '&': "AND", '@': "AT", '*': "TIMES", '+': "PLUS", '\\': "MOD",
                    '-': "MINUS", ',': "COMMA", '/': "DIV", '?': "IF"}[char];
            return repl || 'OPERATOR';
        });
        return cls.replace(/[ ]/, "_") + "__" + op + "__";
    },
},
'generating', {
    generate: function(method, optClass, optSel, optInstVarNames) {
        this.method = method;
        this.sista = method.methodSignFlag();
        this.pc = 0;                // next bytecode
        this.endPC = 0;             // pc of furthest jump target
        this.prevPC = 0;            // pc at start of current instruction
        this.source = [];           // snippets will be joined in the end
        this.sourceLabels = {};     // source pos of generated jump labels
        this.needsLabel = {};       // jump targets
        this.sourcePos = {};        // source pos of optional vars / statements
        this.needsVar = {};         // true if var was used
        this.needsBreak = false;    // insert break check for previous bytecode
        if (optClass && optSel)
            this.source.push("// ", optClass, ">>", optSel, "\n");
        this.instVarNames = optInstVarNames;
        this.allVars = ['context', 'stack', 'rcvr', 'inst[', 'temp[', 'lit['];
        this.sourcePos['context']    = this.source.length; this.source.push("var context = vm.activeContext;\n");
        this.sourcePos['stack']      = this.source.length; this.source.push("var stack = context.pointers;\n");
        this.sourcePos['rcvr']       = this.source.length; this.source.push("var rcvr = vm.receiver;\n");
        this.sourcePos['inst[']      = this.source.length; this.source.push("var inst = rcvr.pointers;\n");
        this.sourcePos['temp[']      = this.source.length; this.source.push("var temp = vm.homeContext.pointers;\n");
        this.sourcePos['lit[']       = this.source.length; this.source.push("var lit = vm.method.pointers;\n");
        this.sourcePos['loop-start'] = this.source.length; this.source.push("while (true) switch (vm.pc) {\ncase 0:\n");
        if (this.sista) this.generateSista(method);
        else this.generateV3(method);
        var funcName = this.functionNameFor(optClass, optSel);
        if (this.singleStep) {
            if (this.debug) this.source.push("// all valid PCs have a label;\n");
            this.source.push("default: throw Error('invalid PC');\n}"); // all PCs handled
        } else {
            this.sourcePos['loop-end'] = this.source.length; this.source.push("default: vm.interpretOne(true); return;\n}");
            this.deleteUnneededLabels();
        }
        this.deleteUnneededVariables();
        var source = "'use strict';\nreturn function " + funcName + "(vm) {\n" + this.source.join("") + "}";
        return new Function(source)();
    },
    generateV3: function(method) {
        this.done = false;
        while (!this.done) {
            var byte = method.bytes[this.pc++],
                byte2 = 0;
            switch (byte & 0xF8) {
                // load inst var
                case 0x00: case 0x08:
                    this.generatePush("inst[", byte & 0x0F, "]");
                    break;
                // load temp var
                case 0x10: case 0x18:
                    this.generatePush("temp[", 6 + (byte & 0xF), "]");
                    break;
                // loadLiteral
                case 0x20: case 0x28: case 0x30: case 0x38:
                    this.generatePush("lit[", 1 + (byte & 0x1F), "]");
                    break;
                // loadLiteralIndirect
                case 0x40: case 0x48: case 0x50: case 0x58:
                    this.generatePush("lit[", 1 + (byte & 0x1F), "].pointers[1]");
                    break;
                // storeAndPop inst var
                case 0x60:
                    this.generatePopInto("inst[", byte & 0x07, "]");
                    break;
                // storeAndPop temp var
                case 0x68:
                    this.generatePopInto("temp[", 6 + (byte & 0x07), "]");
                    break;
                // Quick push
                case 0x70:
                    switch (byte) {
                        case 0x70: this.generatePush("rcvr"); break;
                        case 0x71: this.generatePush("vm.trueObj"); break;
                        case 0x72: this.generatePush("vm.falseObj"); break;
                        case 0x73: this.generatePush("vm.nilObj"); break;
                        case 0x74: this.generatePush("-1"); break;
                        case 0x75: this.generatePush("0"); break;
                        case 0x76: this.generatePush("1"); break;
                        case 0x77: this.generatePush("2"); break;
                    }
                    break;
                // Quick return
                case 0x78:
                    switch (byte) {
                        case 0x78: this.generateReturn("rcvr"); break;
                        case 0x79: this.generateReturn("vm.trueObj"); break;
                        case 0x7A: this.generateReturn("vm.falseObj"); break;
                        case 0x7B: this.generateReturn("vm.nilObj"); break;
                        case 0x7C: this.generateReturn("stack[vm.sp]"); break;
                        case 0x7D: this.generateBlockReturn(); break;
                        default: throw Error("unusedBytecode");
                    }
                    break;
                // Extended bytecodes
                case 0x80: case 0x88:
                    this.generateV3Extended(byte);
                    break;
                // short jump
                case 0x90:
                    this.generateJump((byte & 0x07) + 1);
                    break;
                // short conditional jump
                case 0x98:
                    this.generateJumpIf(false, (byte & 0x07) + 1);
                    break;
                // long jump, forward and back
                case 0xA0:
                    byte2 = method.bytes[this.pc++];
                    this.generateJump(((byte&7)-4) * 256 + byte2);
                    break;
                // long conditional jump
                case 0xA8:
                    byte2 = method.bytes[this.pc++];
                    this.generateJumpIf(byte < 0xAC, (byte & 3) * 256 + byte2);
                    break;
                // SmallInteger ops: + - < > <= >= = ~= * /  @ lshift: lxor: land: lor:
                case 0xB0: case 0xB8:
                    this.generateNumericOp(byte);
                    break;
                // quick primitives: // at:, at:put:, size, next, nextPut:, ...
                case 0xC0: case 0xC8:
                    this.generateQuickPrim(byte);
                    break;
                // send literal selector
                case 0xD0: case 0xD8:
                    this.generateSend("lit[", 1 + (byte & 0x0F), "]", 0, false);
                    break;
                case 0xE0: case 0xE8:
                    this.generateSend("lit[", 1 + (byte & 0x0F), "]", 1, false);
                    break;
                case 0xF0: case 0xF8:
                    this.generateSend("lit[", 1 + (byte & 0x0F), "]", 2, false);
                    break;
            }
        }
    },
    generateV3Extended: function(bytecode) {
        var byte2, byte3;
        switch (bytecode) {
            // extended push
            case 0x80:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePush("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePush("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: this.generatePush("lit[", 1 + (byte2 & 0x3F), "]"); return;
                    case 3: this.generatePush("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
            // extended store
            case 0x81:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generateStoreInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generateStoreInto("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: throw Error("illegal store into literal");
                    case 3: this.generateStoreInto("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
                return;
            // extended pop into
            case 0x82:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePopInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePopInto("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: throw Error("illegal pop into literal");
                    case 3: this.generatePopInto("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
            // Single extended send
            case 0x83:
                byte2 = this.method.bytes[this.pc++];
                this.generateSend("lit[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, false);
                return;
            // Double extended do-anything
            case 0x84:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                switch (byte2 >> 5) {
                    case 0: this.generateSend("lit[", 1 + byte3, "]", byte2 & 31, false); return;
                    case 1: this.generateSend("lit[", 1 + byte3, "]", byte2 & 31, true); return;
                    case 2: this.generatePush("inst[", byte3, "]"); return;
                    case 3: this.generatePush("lit[", 1 + byte3, "]"); return;
                    case 4: this.generatePush("lit[", 1 + byte3, "].pointers[1]"); return;
                    case 5: this.generateStoreInto("inst[", byte3, "]"); return;
                    case 6: this.generatePopInto("inst[", byte3, "]"); return;
                    case 7: this.generateStoreInto("lit[", 1 + byte3, "].pointers[1]"); return;
                }
            // Single extended send to super
            case 0x85:
                byte2 = this.method.bytes[this.pc++];
                this.generateSend("lit[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, true);
                return;
            // Second extended send
            case 0x86:
                 byte2 = this.method.bytes[this.pc++];
                 this.generateSend("lit[", 1 + (byte2 & 0x3F), "]", byte2 >> 6, false);
                 return;
            // pop
            case 0x87:
                this.generateInstruction("pop", "vm.sp--");
                return;
            // dup
            case 0x88:
                this.needsVar['stack'] = true;
                this.generateInstruction("dup", "var dup = stack[vm.sp]; stack[++vm.sp] = dup");
                return;
            // thisContext
            case 0x89:
                this.needsVar['stack'] = true;
                this.generateInstruction("push thisContext", "stack[++vm.sp] = vm.exportThisContext()");
                return;
            // closures
            case 0x8A:
                byte2 = this.method.bytes[this.pc++];
                var popValues = byte2 > 127,
                    count = byte2 & 127;
                this.generateClosureTemps(count, popValues);
                return;
            // call primitive
            case 0x8B:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                this.generateCallPrimitive(byte2 + 256 * byte3, 0x81);
                return
            // remote push from temp vector
            case 0x8C:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                this.generatePush("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // remote store into temp vector
            case 0x8D:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                this.generateStoreInto("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // remote store and pop into temp vector
            case 0x8E:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                this.generatePopInto("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // pushClosureCopy
            case 0x8F:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                var byte4 = this.method.bytes[this.pc++];
                var numArgs = byte2 & 0xF,
                    numCopied = byte2 >> 4,
                    blockSize = byte3 << 8 | byte4;
                this.generateClosureCopy(numArgs, numCopied, blockSize);
                return;
        }
    },
    generateSista: function() {
        this.debug = true;
        var bytes = this.method.bytes,
            b,
            b2,
            b3,
            extA = 0,
            extB = 0;
        this.done = false;
        while (!this.done) {
            b = bytes[this.pc++];
            switch (b) {
                // 1 Byte Bytecodes

                // load receiver variable
                case 0x00: case 0x01: case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07:
                case 0x08: case 0x09: case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x0E: case 0x0F:
                    this.generatePush("inst[", b & 0x0F, "]");
                    break;
                // load literal variable
                case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17:
                case 0x18: case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: case 0x1F:
                    this.generatePush("lit[", 1 + (b & 0x0F), "].pointers[1]");
                    break;
                // load literal constant
                case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25: case 0x26: case 0x27:
                case 0x28: case 0x29: case 0x2A: case 0x2B: case 0x2C: case 0x2D: case 0x2E: case 0x2F:
                case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35: case 0x36: case 0x37:
                case 0x38: case 0x39: case 0x3A: case 0x3B: case 0x3C: case 0x3D: case 0x3E: case 0x3F:
                    this.generatePush("lit[", 1 + (b & 0x1F), "]");
                    break;
                // load temporary variable
                case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x47:
                    this.generatePush("temp[", 6 + (b & 0x07), "]");
                    break;
                case 0x48: case 0x49: case 0x4A: case 0x4B:
                    this.generatePush("temp[", 6 + (b & 0x03) + 8, "]");
                    break;
                case 0x4C: this.generatePush("rcvr");
                    break;
                case 0x4D: this.generatePush("vm.trueObj");
                    break;
                case 0x4E: this.generatePush("vm.falseObj");
                    break;
                case 0x4F: this.generatePush("vm.nilObj");
                    break;
                case 0x50: this.generatePush(0);
                    break;
                case 0x51: this.generatePush(1);
                    break;
                case 0x52:
                    this.needsVar['stack'] = true;
                    this.generateInstruction("push thisContext", "stack[++vm.sp] = vm.exportThisContext()");
                    break;
                case 0x53:
                    this.needsVar['stack'] = true;
                    this.generateInstruction("dup", "var dup = stack[vm.sp]; stack[++vm.sp] = dup");
                    break;
                case 0x54: case 0x55: case 0x56: case 0x57:
                    throw Error("unusedBytecode");
                case 0x58: this.generateReturn("rcvr");
                    break;
                case 0x59: this.generateReturn("vm.trueObj");
                    break;
                case 0x5A: this.generateReturn("vm.falseObj");
                    break;
                case 0x5B: this.generateReturn("vm.nilObj");
                    break;
                case 0x5C: this.generateReturn("stack[vm.sp]");
                    break;
                case 0x5D: this.generateBlockReturn("vm.nilObj");
                    break;
                case 0x5E: this.generateBlockReturn();
                    break;
                case 0x5F: break; // nop
                case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66: case 0x67:
                case 0x68: case 0x69: case 0x6A: case 0x6B: case 0x6C: case 0x6D: case 0x6E: case 0x6F:
                    this.generateNumericOp(b);
                    break;
                case 0x70: case 0x71: case 0x72: case 0x73: case 0x74: case 0x75: case 0x76: case 0x77:
                case 0x78: case 0x79: case 0x7A: case 0x7B: case 0x7C: case 0x7D: case 0x7E: case 0x7F:
                    this.generateQuickPrim(b);
                    break;
                case 0x80: case 0x81: case 0x82: case 0x83: case 0x84: case 0x85: case 0x86: case 0x87:
                case 0x88: case 0x89: case 0x8A: case 0x8B: case 0x8C: case 0x8D: case 0x8E: case 0x8F:
                    this.generateSend("lit[", 1 + (b & 0x0F), "]", 0, false);
                    break;
                case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97:
                case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F:
                    this.generateSend("lit[", 1 + (b & 0x0F), "]", 1, false);
                    break;
                case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xA7:
                case 0xA8: case 0xA9: case 0xAA: case 0xAB: case 0xAC: case 0xAD: case 0xAE: case 0xAF:
                    this.generateSend("lit[", 1 + (b & 0x0F), "]", 2, false);
                    break;
                case 0xB0: case 0xB1: case 0xB2: case 0xB3: case 0xB4: case 0xB5: case 0xB6: case 0xB7:
                    this.generateJump((b & 0x07) + 1);
                    break;
                case 0xB8: case 0xB9: case 0xBA: case 0xBB: case 0xBC: case 0xBD: case 0xBE: case 0xBF:
                    this.generateJumpIf(true, (b & 0x07) + 1);
                    break;
                case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5: case 0xC6: case 0xC7:
                    this.generateJumpIf(false, (b & 0x07) + 1);
                    break;
                case 0xC8: case 0xC9: case 0xCA: case 0xCB: case 0xCC: case 0xCD: case 0xCE: case 0xCF:
                    this.generatePopInto("inst[", b & 0x07, "]");
                    break;
                case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7:
                    this.generatePopInto("temp[", 6 + (b & 0x07), "]");
                    break;
                case 0xD8: this.generateInstruction("pop", "vm.sp--");
                    break;
                case 0xD9:
                    throw Error("unumplementedBytecode: 0xD9 (unconditional trap)");
                case 0xDA: case 0xDB: case 0xDC: case 0xDD: case 0xDE: case 0xDF:
                    throw Error("unusedBytecode");

                // 2 Byte Bytecodes
                case 0xE0:
                    b2 = bytes[this.pc++];
                    extA = extA * 256 + b2;
                    continue;
                case 0xE1:
                    b2 = bytes[this.pc++];
                    extB = extB * 256 + (b2 < 128 ? b2 : b2 - 256);
                    continue;
                case 0xE2:
                    b2 = bytes[this.pc++];
                    this.generatePush("inst[", b2 + extA * 256, "]");
                    break;
                case 0xE3:
                    b2 = bytes[this.pc++];
                    this.generatePush("lit[", 1 + b2 + extA * 256, "].pointers[1]");
                    break;
                case 0xE4:
                    b2 = bytes[this.pc++];
                    this.generatePush("lit[", 1 + b2 + extA * 256, "]");
                    break;
                case 0xE5:
                    b2 = bytes[this.pc++];
                    this.generatePush("temp[", 6 + b2, "]");
                    break;
                case 0xE6:
                    throw Error("unusedBytecode");
                case 0xE7:
                    b2 = bytes[this.pc++];
                    var popValues = b2 > 127,
                        count = b2 & 127;
                    this.generateClosureTemps(count, popValues);
                    break;
                case 0xE8:
                    b2 = bytes[this.pc++];
                    this.generatePush(b2 + extB * 256);
                    break;
                case 0xE9:
                    b2 = bytes[this.pc++];
                    this.generatePush("vm.image.getCharacter(", b2 + extB * 256, ")");
                    break;
                case 0xEA:
                    b2 = bytes[this.pc++];
                    this.generateSend("lit[", 1 + (b2 >> 3) + (extA << 5), "]", (b2 & 7) + (extB << 3), false);
                    break;
                case 0xEB:
                    b2 = bytes[this.pc++];
                    var lit = (b2 >> 3) + (extA << 5),
                        numArgs = (b2 & 7) + ((extB & 63) << 3),
                        directed = extB >= 64;
                        this.generateSend("lit[", 1 + lit, "]", numArgs, directed ? "sendSuperDirected" : true);
                    break;
                case 0xEC:
                    throw Error("unimplemented bytecode: 0xEC (class trap)");
                case 0xED:
                    b2 = bytes[this.pc++];
                    this.generateJump(b2 + extB * 256);
                    break;
                case 0xEE:
                    b2 = bytes[this.pc++];
                    this.generateJumpIf(true, b2 + extB * 256);
                    break;
                case 0xEF:
                    b2 = bytes[this.pc++];
                    this.generateJumpIf(false, b2 + extB * 256);
                    break;
                case 0xF0:
                    b2 = bytes[this.pc++];
                    this.generatePopInto("inst[", b2 + extA * 256, "]");
                    break;
                case 0xF1:
                    b2 = bytes[this.pc++];
                    this.generatePopInto("lit[", 1 + b2 + extA * 256, "].pointers[1]");
                    break;
                case 0xF2:
                    b2 = bytes[this.pc++];
                    this.generatePopInto("temp[", 6 + b2, "]");
                    break;
                case 0xF3:
                    b2 = bytes[this.pc++];
                    this.generateStoreInto("inst[", b2 + extA * 256, "]");
                    break;
                case 0xF4:
                    b2 = bytes[this.pc++];
                    this.generateStoreInto("lit[", 1 + b2 + extA * 256, "].pointers[1]");
                    break;
                case 0xF5:
                    b2 = bytes[this.pc++];
                    this.generateStoreInto("temp[", 6 + b2, "]");
                    break;
                case 0xF6: case 0xF7:
                    throw Error("unusedBytecode");

                // 3 Byte Bytecodes

                case 0xF8:
                    b2 = bytes[this.pc++];
                    b3 = bytes[this.pc++];
                    this.generateCallPrimitive(b2 + b3 * 256, 0xF5);
                    break;
                case 0xF9:
                    b2 = bytes[this.pc++];
                    b3 = bytes[this.pc++];
                    this.generatePushFullClosure(b2 + extA * 255, b3);
                    break;
                case 0xFA:
                    b2 = bytes[this.pc++];
                    b3 = bytes[this.pc++];
                    var numArgs = (b2 & 0x07) + (extA & 0x0F) * 8,
                        numCopied = (b2 >> 3 & 0x7) + (extA >> 4) * 8,
                        blockSize = b3 + (extB << 8);
                    this.generateClosureCopy(numArgs, numCopied, blockSize);
                    break;
                case 0xFB:
                    b2 = bytes[this.pc++];
                    b3 = bytes[this.pc++];
                    this.generatePush("temp[", 6 + b3, "].pointers[", b2, "]");
                    break;
                case 0xFC:
                    b2 = bytes[this.pc++];
                    b3 = bytes[this.pc++];
                    this.generateStoreInto("temp[", 6 + b3, "].pointers[", b2, "]");
                    break;
                case 0xFD:
                    b2 = bytes[this.pc++];
                    b3 = bytes[this.pc++];
                    this.generatePopInto("temp[", 6 + b3, "].pointers[", b2, "]");
                    break;
                case 0xFE: case 0xFF:
                    throw Error("unusedBytecode");
            }
            extA = 0;
            extB = 0;
        }
    },
    generatePush: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("push", target, arg1, suffix1, arg2, suffix2);
        this.generateLabel();
        this.needsVar[target] = true;
        this.needsVar['stack'] = true;
        this.source.push("stack[++vm.sp] = ", target);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(";\n");
    },
    generateStoreInto: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("store into", target, arg1, suffix1, arg2, suffix2);
        this.generateLabel();
        this.needsVar[target] = true;
        this.needsVar['stack'] = true;
        this.source.push(target);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = stack[vm.sp];\n");
        this.generateDirty(target, arg1);
    },
    generatePopInto: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("pop into", target, arg1, suffix1, arg2, suffix2);
        this.generateLabel();
        this.needsVar[target] = true;
        this.needsVar['stack'] = true;
        this.source.push(target);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = stack[vm.sp--];\n");
        this.generateDirty(target, arg1);
    },
    generateReturn: function(what) {
        if (this.debug) this.generateDebugCode("return", what);
        this.generateLabel();
        this.needsVar[what] = true;
        this.source.push(
            "vm.pc = ", this.pc, "; vm.doReturn(", what, "); return;\n");
        this.needsBreak = false; // returning anyway
        this.done = this.pc > this.endPC;
    },
    generateBlockReturn: function(retVal) {
        if (this.debug) this.generateDebugCode("block return");
        this.generateLabel();
        if (!retVal) {
            this.needsVar['stack'] = true;
            retVal = "stack[vm.sp--]";
        }
        // actually stack === context.pointers but that would look weird
        this.source.push(
            "vm.pc = ", this.pc, "; vm.doReturn(", retVal, ", context.pointers[0]); return;\n");
        this.needsBreak = false; // returning anyway
    },
    generateJump: function(distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump to " + destination);
        this.generateLabel();
        this.needsVar['context'] = true;
        this.source.push("vm.pc = ", destination, "; ");
        if (distance < 0) this.source.push(
            "\nif (vm.interruptCheckCounter-- <= 0) {\n",
            "   vm.checkForInterrupts();\n",
            "   if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return;\n",
            "}\n");
        if (this.singleStep) this.source.push("\nif (vm.breakOutOfInterpreter) return;\n");
        this.source.push("continue;\n");
        this.needsBreak = false; // already checked
        this.needsLabel[destination] = true;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateJumpIf: function(condition, distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump if " + condition + " to " + destination);
        this.generateLabel();
        this.needsVar['stack'] = true;
        this.source.push(
            "var cond = stack[vm.sp--]; if (cond === vm.", condition, "Obj) {vm.pc = ", destination, "; ");
        if (this.singleStep) this.source.push("if (vm.breakOutOfInterpreter) return; else ");
        this.source.push("continue}\n",
            "else if (cond !== vm.", !condition, "Obj) {vm.sp++; vm.pc = ", this.pc, "; vm.send(vm.specialObjects[25], 0, false); return}\n");
        this.needsLabel[this.pc] = true; // for coming back after #mustBeBoolean send
        this.needsLabel[destination] = true; // obviously
        if (destination > this.endPC) this.endPC = destination;
    },
    generateQuickPrim: function(byte) {
        if (this.debug) this.generateDebugCode("quick send #" + this.specialSelectors[(byte & 0x0F) + 16]);
        this.generateLabel();
        switch (byte & 0x0F) {
            case 0x0: // at:
                this.needsVar['stack'] = true;
                this.source.push(
                    "var a, b; if ((a=stack[vm.sp-1]).sqClass === vm.specialObjects[7] && typeof (b=stack[vm.sp]) === 'number' && b>0 && b<=a.pointers.length) {\n",
                    "  stack[--vm.sp] = a.pointers[b-1];",
                    "} else { var c = vm.primHandler.objectAt(true,true,false); if (vm.primHandler.success) stack[--vm.sp] = c; else {\n",
                    "  vm.pc = ", this.pc, "; vm.sendSpecial(16); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return; }}\n");
                this.needsLabel[this.pc] = true;
                return;
            case 0x1: // at:put:
                this.needsVar['stack'] = true;
                this.source.push(
                    "var a, b; if ((a=stack[vm.sp-2]).sqClass === vm.specialObjects[7] && typeof (b=stack[vm.sp-1]) === 'number' && b>0 && b<=a.pointers.length) {\n",
                    "  var c = stack[vm.sp]; stack[vm.sp-=2] = a.pointers[b-1] = c; a.dirty = true;",
                    "} else { vm.primHandler.objectAtPut(true,true,false); if (vm.primHandler.success) stack[vm.sp-=2] = c; else {\n",
                    "  vm.pc = ", this.pc, "; vm.sendSpecial(17); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return; }}\n");
                this.needsLabel[this.pc] = true;
                return;
            case 0x2: // size
                this.needsVar['stack'] = true;
                this.source.push(
                    "if (stack[vm.sp].sqClass === vm.specialObjects[7]) stack[vm.sp] = stack[vm.sp].pointersSize();\n",     // Array
                    "else if (stack[vm.sp].sqClass === vm.specialObjects[6]) stack[vm.sp] = stack[vm.sp].bytesSize();\n",   // ByteString
                    "else { vm.pc = ", this.pc, "; vm.sendSpecial(18); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return; }\n");
                this.needsLabel[this.pc] = true;
                return;
            //case 0x3: return false; // next
            //case 0x4: return false; // nextPut:
            //case 0x5: return false; // atEnd
            case 0x6: // ==
                this.needsVar['stack'] = true;
                this.source.push("var cond = stack[vm.sp-1] === stack[vm.sp];\nstack[--vm.sp] = cond ? vm.trueObj : vm.falseObj;\n");
                return;
            case 0x7: // class
                this.needsVar['stack'] = true;
                this.source.push("stack[vm.sp] = typeof stack[vm.sp] === 'number' ? vm.specialObjects[5] : stack[vm.sp].sqClass;\n");
                return;
            case 0x8: // blockCopy:
                this.needsVar['rcvr'] = true;
                this.source.push(
                    "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), ")) ",
                    "{vm.sendSpecial(", ((byte & 0x0F) + 16), "); return}\n");
                this.needsLabel[this.pc] = true;        // for send
                this.needsLabel[this.pc + 2] = true;    // for start of block
                return;
            case 0x9: // value
            case 0xA: // value:
            case 0xB: // do:
                this.needsVar['rcvr'] = true;
                this.source.push(
                    "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), ")) vm.sendSpecial(", ((byte & 0x0F) + 16), "); return;\n");
                this.needsLabel[this.pc] = true;
                return;
            //case 0xC: return false; // new
            //case 0xD: return false; // new:
            //case 0xE: return false; // x
            //case 0xF: return false; // y
        }
        // generic version for the bytecodes not yet handled above
        this.needsVar['rcvr'] = true;
        this.needsVar['context'] = true;
        this.source.push(
            "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), "))",
            " vm.sendSpecial(", ((byte & 0x0F) + 16), ");\n",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return;\n");
        this.needsBreak = false; // already checked
        // if falling back to a full send we need a label for coming back
        this.needsLabel[this.pc] = true;
    },
    generateNumericOp: function(byte) {
        if (this.debug) this.generateDebugCode("quick send #" + this.specialSelectors[byte & 0x0F]);
        this.generateLabel();
        // if the op cannot be executed here, do a full send and return to main loop
        // we need a label for coming back
        this.needsLabel[this.pc] = true;
        switch (byte & 0x0F) {
            case 0x0: // PLUS +
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a + b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(0); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x1: // MINUS -
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a - b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(1); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x2: // LESS <
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a < b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(2); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x3: // GRTR >
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a > b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(3); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x4: // LEQ <=
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a <= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(4); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x5: // GEQ >=
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a >= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(5); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x6: // EQU =
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a === b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b && a.float === a.float) {\n",   // NaN check
                "   stack[--vm.sp] = vm.trueObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(6); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x7: // NEQ ~=
                this.needsVar['stack'] = true;
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a !== b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b && a.float === a.float) {\n",   // NaN check
                "   stack[--vm.sp] = vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(7); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return}\n");
                return;
            case 0x8: // TIMES *
                this.source.push("vm.success = true; vm.resultIsFloat = false; if(!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) * vm.stackIntOrFloat(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(8); return}\n");
                return;
            case 0x9: // DIV /
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.quickDivide(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(9); return}\n");
                return;
            case 0xA: // MOD \
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.mod(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(10); return}\n");
                return;
            case 0xB:  // MakePt int@int
                this.source.push("vm.success = true; if(!vm.primHandler.primitiveMakePoint(1, true)) { vm.pc = ", this.pc, "; vm.sendSpecial(11); return}\n");
                return;
            case 0xC: // bitShift:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.safeShift(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(12); return}\n");
                return;
            case 0xD: // Divide //
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.div(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(13); return}\n");
                return;
            case 0xE: // bitAnd:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.stackInteger(1) & vm.stackInteger(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(14); return}\n");
                return;
            case 0xF: // bitOr:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.stackInteger(1) | vm.stackInteger(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(15); return}\n");
                return;
        }
    },
    generateSend: function(prefix, num, suffix, numArgs, superSend) {
        if (this.debug) this.generateDebugCode((superSend ? "super send " : "send ") + (prefix === "lit[" ? this.method.pointers[num].bytesAsString() : "..."));
        this.generateLabel();
        this.needsVar[prefix] = true;
        this.needsVar['context'] = true;
        var send = typeof superSend === "string" ? superSend : "send";
        // set pc, activate new method, and return to main loop
        // unless the method was a successfull primitive call (no context change)
        this.source.push(
            "vm.pc = ", this.pc, "; vm.", send, "(", prefix, num, suffix, ", ", numArgs, ", ", superSend, "); ",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return;\n");
        this.needsBreak = false; // already checked
        // need a label for coming back after send
        this.needsLabel[this.pc] = true;
    },
    generateClosureTemps: function(count, popValues) {
        if (this.debug) this.generateDebugCode("closure temps");
        this.generateLabel();
        this.needsVar['stack'] = true;
        this.source.push("var array = vm.instantiateClass(vm.specialObjects[7], ", count, ");\n");
        if (popValues) {
            for (var i = 0; i < count; i++)
                this.source.push("array.pointers[", i, "] = stack[vm.sp - ", count - i - 1, "];\n");
            this.source.push("stack[vm.sp -= ", count - 1, "] = array;\n");
        } else {
            this.source.push("stack[++vm.sp] = array;\n");
        }
    },
    generateClosureCopy: function(numArgs, numCopied, blockSize) {
        var from = this.pc,
            to = from + blockSize;
        if (this.debug) this.generateDebugCode("push closure(" + from + "-" + (to-1) + "): " + numCopied + " copied, " + numArgs + " args");
        this.generateLabel();
        this.needsVar['stack'] = true;
        this.source.push(
            "var closure = vm.instantiateClass(vm.specialObjects[36], ", numCopied, ");\n",
            "closure.pointers[0] = context; vm.reclaimableContextCount = 0;\n",
            "closure.pointers[1] = ", from + this.method.pointers.length * 4 + 1, ";\n",  // encodeSqueakPC
            "closure.pointers[2] = ", numArgs, ";\n");
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                this.source.push("closure.pointers[", i + 3, "] = stack[vm.sp - ", numCopied - i - 1,"];\n");
            this.source.push("stack[vm.sp -= ", numCopied - 1,"] = closure;\n");
        } else {
            this.source.push("stack[++vm.sp] = closure;\n");
        }
        this.source.push("vm.pc = ", to, ";\n");
        if (this.singleStep) this.source.push("if (vm.breakOutOfInterpreter) return;\n");
        this.source.push("continue;\n");
        this.needsBreak = false; // already checked
        this.needsLabel[from] = true;   // initial pc when activated
        this.needsLabel[to] = true;     // for jump over closure
        if (to > this.endPC) this.endPC = to;
    },
    generatePushFullClosure: function(index, b3) {
        if (this.debug) this.generateDebugCode("push full closure " + (index + 1));
        this.generateLabel();
        this.needsVar['lit['] = true;
        this.needsVar['rcvr'] = true;
        var numCopied = b3 & 63;
        var outer = "vm.nilObj";
        if ((b3 >> 6 & 1) === 1) {
            outer = "context";
            this.needsVar['context'] = true;
        }
        if ((b3 >> 7 & 1) === 1) {
            throw Error("on-stack receiver not yet supported");
        }
        this.source.push("var closure = vm.newFullClosure(", outer, ", ", numCopied, ", lit[", 1 + index, "]);\n");
        this.source.push("closure.pointers[", Squeak.ClosureFull_receiver, "] = rcvr;\n");
        if (outer === "context") this.source.push("vm.reclaimableContextCount = 0;\n");
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                this.source.push("closure.pointers[", i + Squeak.ClosureFull_firstCopiedValue, "] = stack[vm.sp - ", numCopied - i - 1,"];\n");
            this.source.push("stack[vm.sp -= ", numCopied - 1,"] = closure;\n");
        } else {
            this.source.push("stack[++vm.sp] = closure;\n");
        }
    },
    generateCallPrimitive: function(index, extendedStoreBytecode) {
        if (this.debug) this.generateDebugCode("call primitive " + index);
        this.generateLabel();
        if (this.method.bytes[this.pc] === extendedStoreBytecode)  {
            this.needsVar['stack'] = true;
            this.source.push("if (vm.primFailCode) {stack[vm.sp] = vm.getErrorObjectFromPrimFailCode(); vm.primFailCode = 0;}\n");
        }
    },
    generateDirty: function(target, arg) {
        switch(target) {
            case "inst[": this.source.push("rcvr.dirty = true;\n"); break;
            case "lit[": this.source.push(target, arg, "].dirty = true;\n"); break;
            case "temp[": break;
            default:
                throw Error("unexpected target " + target);
        }
    },
    generateLabel: function() {
        // remember label position for deleteUnneededLabels()
        if (this.prevPC) {
            this.sourceLabels[this.prevPC] = this.source.length;
            this.source.push("case ", this.prevPC, ":\n");           // must match deleteUnneededLabels
        }
        this.prevPC = this.pc;
    },
    generateDebugCode: function(command, what, arg1, suffix1, arg2, suffix2) {
        // single-step for previous instructiuon
        if (this.needsBreak) {
             this.source.push("if (vm.breakOutOfInterpreter) {vm.pc = ", this.prevPC, "; return}\n");
             this.needsLabel[this.prevPC] = true;
        }
        // comment for this instruction
        var bytecodes = [];
        for (var i = this.prevPC; i < this.pc; i++)
            bytecodes.push((this.method.bytes[i] + 0x100).toString(16).slice(-2).toUpperCase());
        this.source.push("// ", this.prevPC, " <", bytecodes.join(" "), "> ", command);
        // append argument to comment
        if (what !== undefined) {
            this.source.push(" ");
            switch (what) {
                case 'vm.nilObj':    this.source.push('nil'); break;
                case 'vm.trueObj':   this.source.push('true'); break;
                case 'vm.falseObj':  this.source.push('false'); break;
                case 'rcvr':         this.source.push('self'); break;
                case 'stack[vm.sp]': this.source.push('top of stack'); break;
                case 'inst[':
                    if (!this.instVarNames) this.source.push('inst var ', arg1);
                    else this.source.push(this.instVarNames[arg1]);
                    break;
                case 'temp[':
                    this.source.push('tmp', arg1 - 6);
                    if (suffix1 !== ']') this.source.push('[', arg2, ']');
                    break;
                case 'lit[':
                    var lit = this.method.pointers[arg1];
                    if (suffix1 === ']') this.source.push(lit);
                    else this.source.push(lit.pointers[0].bytesAsString());
                    break;
                default:
                    this.source.push(what);
            }
        }
        this.source.push("\n");
        // enable single-step for next instruction
        this.needsBreak = this.singleStep;
    },
    generateInstruction: function(comment, instr) {
        if (this.debug) this.generateDebugCode(comment);
        this.generateLabel();
        this.source.push(instr, ";\n");
    },
    deleteUnneededLabels: function() {
        // switch statement is more efficient with fewer labels
        var hasAnyLabel = false;
        for (var i in this.sourceLabels)
            if (this.needsLabel[i])
                hasAnyLabel = true;
            else for (var j = 0; j < 3; j++)
               this.source[this.sourceLabels[i] + j] = "";
        if (!hasAnyLabel) {
            this.source[this.sourcePos['loop-start']] = "";
            this.source[this.sourcePos['loop-end']] = "";
        }
    },
    deleteUnneededVariables: function() {
        if (this.needsVar['stack']) this.needsVar['context'] = true;
        if (this.needsVar['inst[']) this.needsVar['rcvr'] = true;
        for (var i = 0; i < this.allVars.length; i++) {
            var v = this.allVars[i];
            if (!this.needsVar[v])
                this.source[this.sourcePos[v]] = "";
        }
    },
});
