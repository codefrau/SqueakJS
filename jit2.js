"use strict";
/*
 * Copyright (c) 2021 Vanessa Freudenberg
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

Object.subclass('Squeak.Compiler2',

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

The result of the compilation is a JS function that can be invoked instead of
interpreting bytecodes individually. Depending on the JIT, that function will be
invoked when the interpreter is about to execute any bytecode, or only for send
bytecodes. The former requires the function to be resumable in the middle of
execution from an existing context object (even if the PC is different from its
initial value, temp vars have been used, there are values on the stack,
thisContext might have been exported etc). Invoking the JIT-compiled function
only for sends allows the JIT to more aggressively change the means of execution,
since no context has been created yet.

    initialize:
        compiler = new Squeak.Compiler(vm);

    executeNewMethod, checkForInterrupts:
        if (!method.interpret && compiler)
            compiler.compile(method);   // Basic JIT creates method.interpret
        else if (!method.run && compiler2)
            compiler2.compile(method);   // New JIT creates method.run

    interpretSend:
        if (method.run) compiler.enterJIT(vm) // switches execution to JIT

    interpretAny:
        if (method.interpret) method.interpret(vm);

Note that a compiler could hook itself into a compiled method by dispatching
to vm.compiler in the generated code. This would allow gathering statistics,
recompiling with optimized code etc.

About the Basic Compiler
========================

The compiler in jit.js was created in 2014. It exactly mimics the interpreter's
execution machinery, with actual context objects for each method activation,
keeping intermediate values on the context's stack, etc. Sends are handled by
falling back to the interpreter. Its speedup comes solely from eliminating the
bytecode decoding overhead, and inlining some bytecoded sends (e.g. SmallInteger
arithmetic and basic Array operations).

It is significantly faster than the interpreter, and even supports
single-stepping in the VM debugger.

About This Compiler
===================

In 2021 this new JIT compiler is being created. Its goal is to be almost as
simple and fast-compiling as the Basic JIT, but speed up execution much more by
generating code that looks much more like regular JS code. E.g., instead of
pushing intermediate results on a stack it uses temporary variables. Instead of
creating context objects for each send, it calls other JIT-compiled methods
directly, passing arguments via function parameters.

It still does not attempt to optimize the execution flow, it is a 1-to-1 mapping
of the original bytecodes. But it makes it possible for the host's optimizing JS
compiler to apply optimizations.

There are some operations this JIT does not support, most notably accessing
thisContext except for block / closure creation, which includes process switching.
Whenever this is needed, the full nested function call sequence is unwound all the
way back to the interpreter, creating actual context objects. Similarly, it can
only call JIT-compiled methods. Compiling everything on first activation is
too expensive, so again, the whole stack will be unwound and contexts reified.

Blocks/Closures are compiled at the same time as their home method. Non-local
returns are handled using exceptions that unwind execution up to their home context,
which then does a regular return. If the image has installed e.g. ensure handlers
then those will be honored by sending aboutToReturn:through:, but since that
requires exporting thisContext, it will again fully unwind back to the interpreter.

Until this JIT is fully functional, we cannot know how much speedup it will bring
in practice. The mockups are promising though, with some browsers reaching
~20% of the performance of Cog, compared to the Basic JIT at about 1% of Cog speed.

*****************************************************************************/

'initialization', {
    initialize: function(vm) {
        this.vm = vm;
        this.comments = true, // generate comments
        // for debug-printing only
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
        this.doitCounter = 0;
        this.count = 0;
    },
},
'accessing', {
    compile: function(method, optClass, optSel) {
        if (method.methodSignFlag()) {
            return; // Sista bytecode set not (yet) supported by JIT
        } else if (method.run === undefined) {
            // 1st time
            method.run = false;
        } else {
            // 2nd time
            this.debug = this.comments;
            var clsName = optClass && optClass.className(),
                sel = optSel && optSel.bytesAsString();
            method.run = this.generate(method, clsName, sel);
        }
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
'decoding', {
    generate: function(method, optClass, optSel, optInstVarNames) {
        const funcName = this.functionNameFor(optClass, optSel);
        console.log(++this.count + " generating " + funcName);
        const numArgs = method.methodNumArgs();
        const numTemps = method.methodTempCount();
        let args = ""; for (let i = 0; i < numArgs; i++) args += `,t${i}`;
        let temps = ""; for (let i = numArgs; i < numTemps; i++) temps += `,t${i}`;
        this.method = method;
        this.pc = 0;                // next bytecode
        this.endPC = 0;             // pc of furthest jump target
        this.prevPC = 0;            // pc at start of current instruction
        this.sp = 0;                // generator SP
        this.maxSP = this.sp;       // num of stack vars needed
        this.PCtoSP = [];           // mapping from pc to sp
        this.source = [];           // snippets will be joined in the end
        this.sourceLabels = {};     // source pos of generated labels
        this.needsLabel = {};       // jump targets
        this.sourcePos = {};        // source pos of optional vars / statements
        this.needsVar = {};         // true if var was used
        this.optionalVars = ['lit[', 'F', 'T', 'inst[', 'thisContext']; // vars to remove if unused
        this.instVarNames = optInstVarNames;
        // start generating source
        this.source.push("'use strict';\n");
        this.sourcePos['pctosp'] = this.source.length + 1; this.source.push("let PCtoSP=[", "", "],\nN=vm.nilObj"); // filled in below
        this.sourcePos['F'] = this.source.length; this.source.push(",F=vm.falseObj"); // deleted later if not needed
        this.sourcePos['T'] = this.source.length; this.source.push(",T=vm.trueObj"); // deleted later if not needed
        this.sourcePos['lit['] = this.source.length; this.source.push(",lit=method.pointers"); // deleted later if not needed
        this.source.push(";\nreturn function ", funcName, "(rcvr", args, "){\n");
        if (this.comments && optClass && optSel) this.source.push("// ", optClass, ">>", optSel, "\n");
        // generate vars
        this.sourcePos['inst[']       = this.source.length; this.source.push("let inst=rcvr.pointers;\n"); // deleted later if not needed
        this.sourcePos['thisContext'] = this.source.length; this.source.push("let thisContext;\n"); // deleted later if not needed
        this.source.push("let pc=0");
        if (numTemps > numArgs) {
            this.needsVar['N'] = true;
            for (let i = numArgs ; i < numTemps; i++) this.source.push(`,t${i}=N`);
        }
        this.sourcePos['stack'] = this.source.length; this.source.push(''); // filled in below
        this.source.push(`;\ntry{\nif(--vm.interruptCheckCounter<=0)vm.jitInterruptCheck();\nif(--vm.depth<=0)throw{};\n`);
        this.sourcePos['loop-start'] = this.source.length; this.source.push(`while(true)switch(pc){\ncase 0:`);
        this.source.push("debugger;\n")
        this.generateBytecodes();
        let stack = ""; for (let i = 1; i < this.maxSP + 1; i++) stack += `,s${i}`;
        this.sourcePos['loop-end'] = this.source.length; this.source.push(`default: throw Error("unexpected PC: " + pc);\n}`);
        this.source.push(`}catch(frame){\n` +
                         `if("nonLocalReturnValue" in frame){vm.depth++;throw frame}\n` +
                         `let c=${this.needsVar["thisContext"]?"thisContext||":""}vm.jitAllocContext();let f=c.pointers;` +
                         `f.push(frame.ctx,pc+${method.pointers.length * 4 + 1},PCtoSP[pc]+${numTemps},method,N,rcvr${args}${temps}${stack});` +
                         `f.length=${method.methodNeedsLargeFrame()?62:22};frame.ctx=c;throw frame}\n}`);
        this.source[this.sourcePos['stack']] = stack;
        this.source[this.sourcePos['pctosp']] = this.PCtoSP;
        this.deleteUnneededLabels();
        this.deleteUnneededVariables();
        let src = this.source.join("");
        try {
            return new Function("vm", "method", src)(this.vm, method);
        } catch(err) {
            console.log(src);
            console.error(err);
            debugger
            return new Function("vm", "method", src)(this.vm, method);
        }
    },
    generateBytecodes() {
        this.done = false;
        while (!this.done) {
            if (this.PCtoSP[this.pc] === undefined) this.PCtoSP[this.pc] = this.sp;
            else { if (this.comments) this.source.push(`// sp set to ${this.PCtoSP[this.pc]} (was ${this.sp})\n`); this.sp = this.PCtoSP[this.pc]; };
            var byte = this.method.bytes[this.pc++],
                byte2 = 0;
            switch (byte & 0xF8) {
                // load inst var
                case 0x00: case 0x08:
                    this.generatePush("inst[", byte & 0x0F, "]");
                    break;
                // load temp var
                case 0x10: case 0x18:
                    this.generatePush("t", byte & 0xF, "");
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
                    this.generatePopInto("t", byte & 0x07, "");
                    break;
                // Quick push
                case 0x70:
                    switch (byte) {
                        case 0x70: this.generatePush("rcvr"); break;
                        case 0x71: this.generatePush("T"); break;
                        case 0x72: this.generatePush("F"); break;
                        case 0x73: this.generatePush("N"); break;
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
                        case 0x79: this.generateReturn("T"); break;
                        case 0x7A: this.generateReturn("F"); break;
                        case 0x7B: this.generateReturn("N"); break;
                        case 0x7C: this.generateReturn(this.top()); break;
                        case 0x7D: this.generateBlockReturn(); break;
                        default: throw Error("unusedBytecode");
                    }
                    break;
                // Extended bytecodes
                case 0x80: case 0x88:
                    this.generateExtended(byte);
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
                    byte2 = this.method.bytes[this.pc++];
                    this.generateJump(((byte&7)-4) * 256 + byte2);
                    break;
                // long conditional jump
                case 0xA8:
                    byte2 = this.method.bytes[this.pc++];
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
        let prev = 0;
        for (let i = 0; i < this.PCtoSP.length; i++) {
            if (this.PCtoSP[i] === undefined) this.PCtoSP[i] = prev;
            else prev = this.PCtoSP[i];
        }
    },
    generateExtended: function(bytecode) {
        var byte2, byte3;
        switch (bytecode) {
            // extended push
            case 0x80:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePush("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePush("t", byte2 & 0x3F, ""); return;
                    case 2: this.generatePush("lit[", 1 + (byte2 & 0x3F), "]"); return;
                    case 3: this.generatePush("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
            // extended store
            case 0x81:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generateStoreInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generateStoreInto("t", byte2 & 0x3F, ""); return;
                    case 2: throw Error("illegal store into literal");
                    case 3: this.generateStoreInto("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
                return;
            // extended pop into
            case 0x82:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePopInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePopInto("t", byte2 & 0x3F, ""); return;
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
                this.generateInstruction("pop", ""); // no-op
                this.sp--;
                return;
            // dup
            case 0x88:
                this.generateInstruction("dup", `${this.push()} = ${this.top()}`);
                return;
            // thisContext
            case 0x89:
                this.needsVar["thisContext"] = true;
                this.generateInstruction("push thisContext", `if(!thisContext)thisContext=vm.jitAllocContext();${this.push()}=thisContext`);
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
                this.generateCallPrimitive(byte2 + 256 * byte3);
                return
            // remote push from temp vector
            case 0x8C:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                this.generatePush("t", byte3, ".pointers[", byte2, "]");
                return;
            // remote store into temp vector
            case 0x8D:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                this.generateStoreInto("t", byte3, ".pointers[", byte2, "]");
                return;
            // remote store and pop into temp vector
            case 0x8E:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                this.generatePopInto("t", byte3, ".pointers[", byte2, "]");
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
},
'helpers', {
    top() {
        return "s" + this.sp;
    },
    push() {
        this.sp++;
        if (this.sp > this.maxSP) this.maxSP = this.sp;
        return "s" + this.sp;
    },
    pop() {
        return "s" + this.sp--;
    }
},
'generating', {
    generatePush: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("push", target, arg1, suffix1, arg2, suffix2);
        this.generateLabel();
        this.needsVar[target] = true;
        this.source.push(`${this.push()}=${target}`);
        if (arg1 !== undefined) { this.source.push(arg1, suffix1);
            if (arg2 !== undefined) this.source.push(arg2, suffix2);
        }
        this.source.push(";");
    },
    generateStoreInto: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("store into", target, arg1, suffix1, arg2, suffix2);
        this.generateLabel();
        this.needsVar[target] = true;
        this.source.push(target);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(`=${this.top()};`);
        this.generateDirty(target, arg1);
    },
    generatePopInto: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("pop into", target, arg1, suffix1, arg2, suffix2);
        this.generateLabel();
        this.needsVar[target] = true;
        this.source.push(target);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(`=${this.pop()};`);
        this.generateDirty(target, arg1);
    },
    generateReturn: function(what) {
        if (this.debug) this.generateDebugCode("return", what);
        this.generateLabel();
        this.needsVar[what] = true;
        this.source.push(`vm.depth++;return ${what};\n`);
        this.done = this.pc > this.endPC;
    },
    generateBlockReturn: function() {
        if (this.debug) this.generateDebugCode("block return");
        // this.generateLabel();
        this.generateUnimplemented("block return")
    },
    generateJump: function(distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump to " + destination);
        this.generateLabel();
        this.source.push(`pc=${destination};`);
        if (distance < 0) this.source.push("if(--vm.interruptCheckCounter<=0)vm.checkForInterrupts();");
        else if (this.PCtoSP[destination] === undefined) this.PCtoSP[destination] = this.sp;
        this.source.push("continue;\n");
        this.needsLabel[destination] = true;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateJumpIf: function(bool, distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump if " + bool + " to " + destination);
        var prevPC = this.prevPC;
        this.generateLabel();
        const v = this.pop();
        this.source.push(`if(${v}===${bool?"T":"F"}){pc=${destination};continue}`);
        this.source.push(`else if(${v}!==${bool?"F":"T"}){pc=${prevPC};throw Error("todo: send #mustBeBoolean");}`);
        this.needsLabel[destination] = true;
        this.needsVar["F"] = true;
        this.needsVar["T"] = true;
        if (this.PCtoSP[destination] === undefined) this.PCtoSP[destination] = this.sp;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateQuickPrim: function(byte) {
        const lobits = (byte & 0x0F) + 16;
        if (this.debug) this.generateDebugCode("quick send #" + this.specialSelectors[lobits]);
        const pc = this.prevPC;
        this.generateLabel();
        switch (byte) {
        //     case 0xC0: // at:
        //     case 0xC1: // at:put:
        //     case 0xC2: // size
        //     case 0xC3: // next
        //     case 0xC4: // nextPut:
        //     case 0xC5: // atEnd
        case 0xC6: // ==
            this.needsVar["F"] = true; this.needsVar["T"] = true;
            const b = this.pop(), a = this.top(); this.source.push(`${a}=${a}===${b}?T:F;`);
            return;
        //     case 0xC7: // class
        //     case 0xC8: // blockCopy:
        //     case 0xC9: // value
        //     case 0xCA: // value:
        //     case 0xCB: // do:
        //     case 0xCC: // new
        //     case 0xCD: // new:
        //     case 0xCE: // x
        //     case 0xCF: // y
        }
        // generic version for the bytecodes not yet handled above
        let numArgs = this.vm.specialSelectors[(lobits*2)+1];
        this.sp -= numArgs;
        this.source.push(`pc=${pc};throw {message: "quick send #${this.specialSelectors[lobits]} not implemented yet"};`);
    },
    generateNumericOp: function(byte) {
        const lobits = byte & 0x0F;
        if (this.debug) this.generateDebugCode("quick send #" + lobits);
        // this.generateLabel();
        // switch (byte) {
        //     case 0xB0: // PLUS +
        //     case 0xB1: // MINUS -
        //     case 0xB2: // LESS <
        //     case 0xB3: // GRTR >
        //     case 0xB4: // LEQ <=
        //     case 0xB5: // GEQ >=
        //     case 0xB6: // EQU =
        //     case 0xB7: // NEQ ~=
        //     case 0xB8: // TIMES *
        //     case 0xB9: // DIV /
        //     case 0xBA: // MOD \
        //     case 0xBB:  // MakePt int@int
        //     case 0xBC: // bitShift:
        //     case 0xBD: // Divide //
        //     case 0xBE: // bitAnd:
        //     case 0xBF: // bitOr:
        // }
        // generic version for the bytecodes not yet handled above
        let numArgs = this.vm.specialSelectors[(lobits*2)+1];
        this.sp -= numArgs;
        this.generateUnimplemented("quick send #" + this.specialSelectors[lobits]);
    },
    generateSend: function(prefix, num, suffix, numArgs, superSend) {
        if (this.debug) this.generateDebugCode((superSend ? "super " : "send ") + (prefix === "lit[" ? this.method.pointers[num].bytesAsString() : "..."));
        // this.generateLabel();
        this.needsVar[prefix] = true;
        this.sp -= numArgs;
        this.generateUnimplemented(`${superSend ? "super send" : "send"} ${prefix === "lit[" ? "literal #" + num : prefix}`);
    },
    generateClosureTemps: function(count, popValues) {
        if (this.debug) this.generateDebugCode("closure temps");
        // this.generateLabel();
        this.generateUnimplemented("closure temps");
    },
    generateClosureCopy: function(numArgs, numCopied, blockSize) {
        var from = this.pc,
            to = from + blockSize;
        if (this.debug) this.generateDebugCode("push closure(" + from + "-" + (to-1) + "): " + numCopied + " copied, " + numArgs + " args");
        // this.generateLabel();
        this.generateUnimplemented("closure copy");
        if (to > this.endPC) this.endPC = to;
    },
    generateCallPrimitive: function(index) {
        if (this.debug) this.generateDebugCode("call primitive " + index);
        this.generateLabel();
        if (this.method.bytes[this.pc] === 0x81)  {// extended store
            this.source.push(`if (vm.primFailCode) { t${this.sp} = vm.getErrorObjectFromPrimFailCode(); vm.primFailCode = 0;}\n`);
        }
    },
    generateDirty: function(target, arg) {
        switch(target) {
            case "inst[": this.source.push("rcvr.dirty=true;"); break;
            case "lit[": this.source.push("lit[", arg, "].dirty=true;"); break;
            case "t": break;
            default:
                throw Error("unexpected target " + target);
        }
    },
    generateLabel: function() {
        // remember label position for deleteUnneededLabels()
        if (this.prevPC) {
            this.sourceLabels[this.prevPC] = this.source.length;
            this.source.push("\ncase ", this.prevPC, ":");           // must match deleteUnneededLabels
        }
        this.prevPC = this.pc;
    },
    generateDebugCode: function(command, what, arg1, suffix1, arg2, suffix2) {
        // comment for this instruction
        var bytecodes = [];
        for (var i = this.prevPC; i < this.pc; i++)
            bytecodes.push((this.method.bytes[i] + 0x100).toString(16).slice(-2).toUpperCase());
        this.source.push("\n\n// ", this.prevPC, " <", bytecodes.join(" "), "> ", command);
        // append argument to comment
        if (what) {
            this.source.push(" ");
            switch (what) {
                case 'N':    this.source.push('nil'); break;
                case 'T':   this.source.push('true'); break;
                case 'F':  this.source.push('false'); break;
                case 'rcvr':         this.source.push('self'); break;
                case 'inst[':
                    if (!this.instVarNames) this.source.push('inst var ', arg1);
                    else this.source.push(this.instVarNames[arg1]);
                    break;
                case 't':
                    this.source.push('temp ', arg1);
                    if (suffix1 !== '') this.source.push('[', arg2, ']');
                    break;
                case 'lit[':
                    var lit = this.method.pointers[arg1];
                    if (suffix1 === ']') this.source.push(lit);
                    else this.source.push(lit.pointers[0].bytesAsString());
                    break;
                default:
                    if (what === this.top()) what = "top";
                    this.source.push(what);
            }
        }
        this.source.push("\n");
    },
    generateUnimplemented: function(command, what, arg1, suffix1, arg2, suffix2) {
        const pc = this.prevPC;
        this.generateLabel();
        this.source.push(`pc=${pc};throw {message: "Not yet implemented: ${command}`);
        // append argument
        if (what) {
            this.source.push(" ");
            switch (what) {
                case 'N':    this.source.push('nil'); break;
                case 'T':   this.source.push('true'); break;
                case 'F':  this.source.push('false'); break;
                case 'rcvr':         this.source.push('self'); break;
                case 'inst[':        this.source.push('inst var ', arg1); break;
                case 't':
                    this.source.push('temp ', arg1);
                    if (suffix1 !== '') this.source.push('[', arg2, ']');
                    break;
                case 'lit[':
                    if (suffix1 === ']') this.source.push('literal ', arg1);
                    else this.source.push('literal var ', arg1);
                    break;
                default:
                    if (what === this.top()) what = "top";
                    this.source.push(what);
            }
        }
        this.source.push(`"};`);
    },
    generateInstruction: function(comment, instr) {
        if (this.debug) this.generateDebugCode(comment);
        this.generateLabel();
        if (instr) this.source.push(instr, ";");
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
        if (this.needsVar['inst[']) this.needsVar['rcvr'] = true;
        for (var i = 0; i < this.optionalVars.length; i++) {
            var v = this.optionalVars[i];
            if (!this.needsVar[v])
                this.source[this.sourcePos[v]] = "";
        }
    },
});
