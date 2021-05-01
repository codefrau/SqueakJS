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
        // find context superclass (ContextPart in old images, Context in new ones)
        this.ContextClass = vm.specialObjects[Squeak.splOb_ClassMethodContext];
        while (this.ContextClass.superclass().classInstSize() > 2) this.ContextClass = this.ContextClass.superclass();
        this.comments = true, // generate comments
        // JS equivalents for numeric ops
        this.jsOperators = ['+', '-', '<', '>', '<=', '>=', '===', '!==', '*'];
        // for debug-printing only
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
        this.doitCounter = 0;
        this.count = 0;
    },
},
'accessing', {
    compile: function(method, mClass, selector, force=false) {
        if (method.methodSignFlag()) {
            return; // Sista bytecode set not (yet) supported by JIT
        } else if (method.run === undefined && !force) {
            // 1st time
            method.run = false;
        } else {
            // 2nd time
            this.debug = this.comments;
            method.run = this.generate(method, mClass, mClass.className(), selector.bytesAsString());
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
    generate: function(method, mClass, clsName, sel, optInstVarNames) {
        this.count++;
        const funcName = this.functionNameFor(clsName, sel);
        // console.log(this.count + " generating " + funcName);
        this.isContext = mClass.includesBehavior(this.ContextClass);
        const primitive = method.methodPrimitiveIndex();
        if (primitive > 255 && primitive < 520) return this.quickPrimitive(funcName, primitive);
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
        this.cache = 0;             // number of inline cache entries
        this.needsVar = {};         // true if var was used
        this.isLeaf = true;         // if there are no sends we can simplify the method because no throws
        this.nonLeafCode = [];      // source positions of code to be removed if leaf
        this.optionalVars = ['L[', 'F', 'T', 'i[', 'thisContext', '_']; // vars to remove if unused
        this.instVarNames = optInstVarNames;
        // start generating source
        this.source.push("'use strict';return function ", funcName, "(r", args, "){\n");
        if (this.comments && clsName && sel) this.source.push("// ", clsName, ">>", sel, "\n");
        // generate vars
        this.source.push("let "); this.sourcePos['vars'] = this.source.length;
        this.sourcePos['i['] = this.source.length; this.source.push(",i=r.pointers"); // deleted later if not needed
        this.sourcePos['thisContext'] = this.source.length; this.source.push(",thisContext"); // deleted later if not needed
        this.sourcePos['_'] = this.source.length; this.source.push(",_"); // deleted later if not needed
        if (numTemps > numArgs) {
            for (let i = numArgs ; i < numTemps; i++) this.source.push(`,t${i}=N`);
        }
        this.sourcePos['stack'] = this.source.length; this.source.push(''); // filled in below
        this.source.push(",pc=0,sp=0;\n");
        // now the actual code
        this.genUnlessLeaf(`try{\nif(--VM.depth<=0)throw{};\nif(--VM.interruptCheckCounter<=0)VM.jitInterruptCheck();\n`);
        this.sourcePos['loop-start'] = this.source.length; this.source.push(`while(true)switch(pc){\ncase 0:`);
        this.generateBytecodes();
        let stack = ""; for (let i = 1; i < this.maxSP + 1; i++) stack += `,s${i}`;
        this.sourcePos['loop-end'] = this.source.length; this.source.push(`default: throw Error("unexpected PC: " + pc);\n}`);
        this.genUnlessLeaf(`}catch(frame){\n` +
                         `if("nonLocalReturnValue" in frame){VM.depth++;throw frame}\n` +
                         `if(frame instanceof Error)debugger;\n` +
                         `let c=${this.needsVar["thisContext"]?"thisContext||":""}VM.jitAllocContext();let f=c.pointers;` +
                         `f.push(frame.ctx,pc+${method.pointers.length * 4 + 1},sp+${numTemps},M,N,r${args}${temps}${stack});` +
                         `f.length=${method.methodNeedsLargeFrame()?62:22};frame.ctx=c;throw frame}`);
        this.source.push("\n}");
        this.source[this.sourcePos['stack']] = stack;
        if (this.isLeaf) this.deleteNonLeafCode();
        this.deleteUnneededLabels();
        this.deleteUnneededVariables();
        const src = this.source.join("");
        const cache = this.cache && new Array(this.cache).fill(this.vm.nilObj);
        try {
            return new Function("VM", "N", "F", "T", "M", "L", "C", src)
                (this.vm, this.vm.nilObj, this.vm.falseObj, this.vm.trueObj, method, method.pointers, cache);
        } catch(err) {
            console.log(src);
            console.error(err);
            debugger
            return new Function("VM", "N", "F", "T", "M", "L", "C", src)
                (this.vm, this.vm.nilObj, this.vm.falseObj, this.vm.trueObj, method, method.pointers, cache);
        }
    },
    quickPrimitive: function(funcName, primIndex) {
        if (primIndex >= 264) {
            // return inst var
            if (!this.isContext) return new Function(`return function ${funcName}(r){return r.pointers[${primIndex - 264}]}`)();
            // we can only handle reified contexts, otherwise bail out
            return new Function(`return function ${funcName}(r) {
                if (r.pointers.length > 0) return r.pointers[${primIndex - 264}];
                throw{message:"context var push",op:{o:"push",r,i:${primIndex - 264}}}
            }`)();
        }
        switch (primIndex) {
            case 256: return new Function(`return function ${funcName}(r){return r}`)(); // return self
            case 257: return new Function("T", `return function ${funcName}(){return T}`)(this.vm.trueObj); // return true
            case 258: return new Function("F", `return function ${funcName}(){return F}`)(this.vm.falseObj); // return true
            case 259: return new Function("N", `return function ${funcName}(){return N}`)(this.vm.nilObj); // return true
            default: return new Function(`return function ${funcName}(){return ${primIndex - 261}}`)();  // return -1...2
        }
    },
    generateBytecodes: function() {
        this.done = false;
        while (!this.done) {
            if (this.PCtoSP[this.pc] === undefined) this.PCtoSP[this.pc] = this.sp;
            else { if (this.comments) this.source.push(`// sp set to ${this.PCtoSP[this.pc]} (was ${this.sp})\n`); this.sp = this.PCtoSP[this.pc]; };
            var byte = this.method.bytes[this.pc++],
                byte2 = 0;
            switch (byte & 0xF8) {
                // load inst var
                case 0x00: case 0x08:
                    this.generatePush("i[", byte & 0x0F, "]");
                    break;
                // load temp var
                case 0x10: case 0x18:
                    this.generatePush("t", byte & 0xF, "");
                    break;
                // loadLiteral
                case 0x20: case 0x28: case 0x30: case 0x38:
                    this.generatePush("L[", 1 + (byte & 0x1F), "]");
                    break;
                // loadLiteralIndirect
                case 0x40: case 0x48: case 0x50: case 0x58:
                    this.generatePush("L[", 1 + (byte & 0x1F), "].pointers[1]");
                    break;
                // storeAndPop inst var
                case 0x60:
                    this.generatePopInto("i[", byte & 0x07, "]");
                    break;
                // storeAndPop temp var
                case 0x68:
                    this.generatePopInto("t", byte & 0x07, "");
                    break;
                // Quick push
                case 0x70:
                    switch (byte) {
                        case 0x70: this.generatePush("r"); break;
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
                        case 0x78: this.generateReturn("r"); break;
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
                    this.generateQuickSend(byte);
                    break;
                // send literal selector
                case 0xD0: case 0xD8:
                    this.generateSend("L[", 1 + (byte & 0x0F), "]", 0, false);
                    break;
                case 0xE0: case 0xE8:
                    this.generateSend("L[", 1 + (byte & 0x0F), "]", 1, false);
                    break;
                case 0xF0: case 0xF8:
                    this.generateSend("L[", 1 + (byte & 0x0F), "]", 2, false);
                    break;
            }
        }
    },
    generateExtended: function(bytecode) {
        var byte2, byte3;
        switch (bytecode) {
            // extended push
            case 0x80:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePush("i[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePush("t", byte2 & 0x3F, ""); return;
                    case 2: this.generatePush("L[", 1 + (byte2 & 0x3F), "]"); return;
                    case 3: this.generatePush("L[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
            // extended store
            case 0x81:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generateStoreInto("i[", byte2 & 0x3F, "]"); return;
                    case 1: this.generateStoreInto("t", byte2 & 0x3F, ""); return;
                    case 2: throw Error("illegal store into literal");
                    case 3: this.generateStoreInto("L[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
                return;
            // extended pop into
            case 0x82:
                byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePopInto("i[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePopInto("t", byte2 & 0x3F, ""); return;
                    case 2: throw Error("illegal pop into literal");
                    case 3: this.generatePopInto("L[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
            // Single extended send
            case 0x83:
                byte2 = this.method.bytes[this.pc++];
                this.generateSend("L[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, false);
                return;
            // Double extended do-anything
            case 0x84:
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                switch (byte2 >> 5) {
                    case 0: this.generateSend("L[", 1 + byte3, "]", byte2 & 31, false); return;
                    case 1: this.generateSend("L[", 1 + byte3, "]", byte2 & 31, true); return;
                    case 2: this.generatePush("i[", byte3, "]"); return;
                    case 3: this.generatePush("L[", 1 + byte3, "]"); return;
                    case 4: this.generatePush("L[", 1 + byte3, "].pointers[1]"); return;
                    case 5: this.generateStoreInto("i[", byte3, "]"); return;
                    case 6: this.generatePopInto("i[", byte3, "]"); return;
                    case 7: this.generateStoreInto("L[", 1 + byte3, "].pointers[1]"); return;
                }
            // Single extended send to super
            case 0x85:
                byte2 = this.method.bytes[this.pc++];
                this.generateSend("L[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, true);
                return;
            // Second extended send
            case 0x86:
                 byte2 = this.method.bytes[this.pc++];
                 this.generateSend("L[", 1 + (byte2 & 0x3F), "]", byte2 >> 6, false);
                 return;
            // pop
            case 0x87:
                this.generateInstruction("pop", ""); // no-op
                this.sp--;
                return;
            // dup
            case 0x88:
                this.generateInstruction("dup", this.pushValue(this.top()));
                return;
            // thisContext
            case 0x89:
                this.needsVar["thisContext"] = true;
                this.generateInstruction("push thisContext", `if(!thisContext)thisContext=VM.jitAllocContext();${this.pushValue("thisContext")}`);
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
                if (this.prevPC !== 0) {debugger;throw Error("inline primitive not handled yet");}
                byte2 = this.method.bytes[this.pc++];
                byte3 = this.method.bytes[this.pc++];
                var primIndex = byte2 + 256 * byte3;
                if (this.method.bytes[this.pc] !== 0x81) {
                    // if not followed by extended store, ignore for now
                    this.generateInstruction("call primitive " + primIndex, ""); // no-op
                } else {
                    // store into temp 0
                    this.pc++;
                    if (this.method.bytes[this.pc++] !== 0x40) {debugger;throw Error("unexpected prim failcode store");}
                    this.generateStorePrimFailCode(primIndex);
                }
                return;
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
    top: function() {
        return "s" + this.sp;
    },
    push: function() {
        this.sp++;
        if (this.sp > this.maxSP) this.maxSP = this.sp;
        return "s" + this.sp;
    },
    pop: function() {
        return "s" + this.sp--;
    },
    pushValue: function(value) {
        return this.push() + "=" + value;
    },
},
'generating', {
    generatePush: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("push", target, arg1, suffix1, arg2, suffix2);
        const pc = this.pc, sp = this.sp; // pc after label, sp before push
        this.generateLabel();
        this.needsVar[target] = true;
        const ctx = this.isContext && target === 'i[';
        if (ctx) this.source.push("if(i.length>0)");    // reified context is fine, otherwise bail out
        this.source.push(`${this.push()}=${target}`);
        if (arg1 !== undefined) { this.source.push(arg1, suffix1);
            if (arg2 !== undefined) this.source.push(arg2, suffix2);
        }
        this.source.push(";");
        if (ctx) this.source.push(`else{pc=${pc};sp=${sp};throw{message:"context read",op:{o:"push",r,i:${arg1}}}}`);
    },
    generateStoreInto: function(target, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("store into", target, arg1, suffix1, arg2, suffix2);
        this.generateLabel();
        this.needsVar[target] = true;
        const ctx = this.isContext && target === 'i[';
        if (ctx) this.source.push(`if(i.length===0)throw Error("context write not yet implemented")\n`);
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
        const ctx = this.isContext && target === 'i[';
        if (ctx) this.source.push(`if(i.length===0)throw Error("context write not yet implemented")\n`);
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
        this.genUnlessLeaf("VM.depth++;");
        this.source.push(`VM.jitSuccessCount++;`);
        this.source.push(`return ${what};\n`);
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
        if (distance < 0) this.source.push(`sp=${this.sp};if(--VM.interruptCheckCounter<=0)VM.jitInterruptCheck();`);
        else if (this.PCtoSP[destination] === undefined) this.PCtoSP[destination] = this.sp;
        this.source.push("continue;\n");
        this.needsLabel[destination] = true;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateJumpIf: function(bool, distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump if " + bool + " to " + destination);
        var pc = this.prevPC;
        var sp = this.sp;
        this.generateLabel();
        const v = this.pop();
        this.source.push(`if(${v}===${bool?"T":"F"}){pc=${destination};continue}`);
        this.source.push(`else if(${v}!==${bool?"F":"T"}){pc=${pc};sp=${sp};throw Error("todo: send #mustBeBoolean");}`);
        this.needsLabel[destination] = true;
        this.isLeaf = false; // could send mustBeBoolean
        if (this.PCtoSP[destination] === undefined) this.PCtoSP[destination] = this.sp;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateNumericOp: function(byte) {
        const lobits = byte & 0x0F;
        if (this.debug) this.generateDebugCode("quick send " + this.specialSelectors[lobits]);
        const pc = this.prevPC;
        const sp = this.sp;
        this.generateLabel();
        switch (byte) {
            case 0xB0: // PLUS +
            case 0xB1: // MINUS -
                var b = this.pop(), a = this.top(), op = this.jsOperators[lobits];
                this.source.push(`if(typeof ${a}==="number"&&typeof ${b}==="number"){${a}${op}=${b};if(${a}>0x3FFFFFFF)${a}=VM.jitLargePos32(${a});else if(${a}<-0x40000000)${a}=VM.jitLargeNeg32(${a})}\nelse{`);
                this.generateCachedSend(pc, sp, a, `VM.specialSelectors[${lobits*2}]`, 1, false, this.specialSelectors[lobits]);
                this.source.push("}\n");
                return;
            case 0xB2: // LESS <
            case 0xB3: // GRTR >
            case 0xB4: // LEQ <=
            case 0xB5: // GEQ >=
            case 0xB6: // EQU =
            case 0xB7: // NEQ ~=
                var b = this.pop(), a = this.top(), op = this.jsOperators[lobits];
                this.source.push(`if(typeof ${a}==="number"&&typeof ${b}==="number")${a}=${a}${op}${b}?T:F;\nelse{`);
                this.generateCachedSend(pc, sp, a, `VM.specialSelectors[${lobits*2}]`, 1, false, this.specialSelectors[lobits]);
                this.source.push("}\n");
                return;
        //     case 0xB8: // TIMES *
        //     case 0xB9: // DIV /
        //     case 0xBA: // MOD \
        //     case 0xBB:  // MakePt int@int
        //     case 0xBC: // bitShift:
        //     case 0xBD: // Divide //
        //     case 0xBE: // bitAnd:
        //     case 0xBF: // bitOr:
        }
        // generic version for the bytecodes not yet handled above
        let numArgs = this.vm.specialSelectors[(lobits*2)+1];
        this.sp -= numArgs;
        this.source.push(`pc=${pc};sp=${sp};throw {message: "Not yet implemented: quick send ${this.specialSelectors[lobits]} to " + VM.jitInstName(${this.top()})};`);
        this.isLeaf = false; // throws
    },
    generateQuickSend: function(byte) {
        const lobits = (byte & 0x0F) + 16;
        if (this.debug) this.generateDebugCode("quick send " + this.specialSelectors[lobits]);
        const pc = this.prevPC;
        const sp = this.sp;
        this.generateLabel();
        switch (byte) {
        case 0xC0: // at:
            var b = this.pop(), a = this.top();
            this.source.push(`if(${a}.sqClass===VM.specialObjects[7]&&typeof ${b}==="number"&&${a}.pointers&&${b}>0&&${b}<=${a}.pointers.length)${a}=${a}.pointers[${b}-1];\nelse `); // Array
            this.source.push(`if(${a}.sqClass===VM.specialObjects[6]&&typeof ${b}==="number"&&${a}.bytes&&${b}>0&&${b}<=${a}.bytes.length)${a}=VM.jitChar(${a}.bytes[${b}-1]);\nelse{`); // String
            this.generateCachedSend(pc, sp, a, `VM.specialSelectors[${lobits*2}]`, 1, false, this.specialSelectors[lobits]);
            this.source.push("}\n");
            return;
        case 0xC1: // at:put:
            this.needsVar['_'] = true;
            var c = this.pop(), b = this.pop(), a = this.top();
            this.source.push(`if(${a}.sqClass===VM.specialObjects[7]&&typeof ${b}==="number"&&${a}.pointers&&${b}>0&&${b}<=${a}.pointers.length)${a}=${a}.pointers[${b}-1]=${c};\nelse `); // Array
            this.source.push(`if(${a}.sqClass===VM.specialObjects[6]&&typeof ${b}==="number"&&${c}.sqClass===VM.specialObjects[19]&&(_=VM.jitUnchar(${c}))<256&&${a}.bytes&&${b}>0&&${b}<=${a}.bytes.length){${a}.bytes[${b}-1]=_;${a}=${c}}\nelse{`); // String
            this.generateCachedSend(pc, sp, a, `VM.specialSelectors[${lobits*2}]`, 1, false, this.specialSelectors[lobits]);
            this.source.push("}\n");
            return;
        case 0xC2: // size
            var a = this.top();
            this.source.push(`if(${a}.sqClass===VM.specialObjects[7])${a}=${a}.pointersSize();\nelse `); // Array
            this.source.push(`if(${a}.sqClass===VM.specialObjects[6])${a}=${a}.bytesSize();\nelse{`);    // ByteString
            this.generateCachedSend(pc, sp, a, `VM.specialSelectors[${lobits*2}]`, 0, false, this.specialSelectors[lobits]);
            this.source.push("}\n");
            return;
        //     case 0xC3: // next
        //     case 0xC4: // nextPut:
        //     case 0xC5: // atEnd
        case 0xC6: // ==
            var b = this.pop(), a = this.top(); this.source.push(`${a}=${a}===${b}?T:F;`);
            return;
        case 0xC7: // class
            var a = this.top();
            this.source.push(`${a}=typeof ${a}==="number"?VM.specialObjects[5]:${a}.sqClass;\n`);
            return;
        //     case 0xC8: // blockCopy:
        //     case 0xC9: // value
        //     case 0xCA: // value:
        //     case 0xCB: // do:
        //     case 0xCC: // new
        case 0xCD: // new:
            var b = this.pop(), a = this.top();
            this.source.push(`if(${a}===VM.specialObjects[7])${a}=VM.jitArrayN(${b});\nelse `);  // Array
            this.source.push(`if(${a}===VM.specialObjects[6])${a}=VM.jitStringN(${b});\nelse{`); // ByteString
            this.generateCachedSend(pc, sp, a, `VM.specialSelectors[${lobits*2}]`, 0, false, this.specialSelectors[lobits]);
            this.source.push("}\n");
            return;
        case 0xCE: // x
        case 0xCF: // y
            var a = this.top();
            this.source.push(`if(${a}.sqClass===VM.specialObjects[12])${a}=${a}.pointers[${byte&1}];\nelse{`);  // Point
            this.generateCachedSend(pc, sp, a, `VM.specialSelectors[${lobits*2}]`, 0, false, this.specialSelectors[lobits]);
            this.source.push("}\n");
            return;
        }
        // generic version for the bytecodes not yet handled above
        const numArgs = this.vm.specialSelectors[(lobits*2)+1];
        this.sp -= numArgs;
        this.source.push(`pc=${pc};sp=${sp};throw {message: "Not yet implemented: quick send ${this.specialSelectors[lobits]} to " + VM.jitInstName(${this.top()})};`);
        this.isLeaf = false; // could do full send
    },
    generateSend: function(prefix, num, suffix, numArgs, superSend) {
        if (this.debug) this.generateDebugCode((superSend ? "super " : "send ") + (prefix === "L[" ? this.method.pointers[num].bytesAsString() : "..."));
        const pc = this.prevPC;
        const sp = this.sp;
        this.generateLabel();
        this.needsVar[prefix] = true;
        this.isLeaf = false;
        let args = ""; for (let i = 0; i < numArgs; i++) args = `,${this.pop()}` + args;
        const rcvr = this.pop();
        // method class for super sends is the last literal's value, its superclass is where we start lookup
        const lookupClass = superSend ? `L[${this.method.methodNumLits()}].pointers[1].pointers[0]` : `${rcvr}.sqClass`;
        const cls = this.cache++, func = this.cache++;
        this.source.push(
            `pc=${pc};sp=${sp};`,    // this PC is used when the lookup throws an error, before popping args off the stack
            `if(C[${cls}]!==${rcvr}.sqClass){`,
                `C[${func}]=VM.jitCache(C,${cls},${lookupClass},${prefix+num+suffix},${numArgs});`,
                `C[${cls}]=${rcvr}.sqClass`,
            `}\n`,
            `VM.sendCount++;`,
            `pc=${this.prevPC};sp=${this.sp};`,    // and this PC is used when the called function unwinds, args+rcvr are already popped
            this.pushValue(`C[${func}](${rcvr}${args})`), `;`);
    },
    generateCachedSend(pc, sp, rcvrVar, selectorExpr, numArgs, superSend, debugSel) {
        this.source.push(`pc=${pc};sp=${sp};/*${rcvrVar}.send(${selectorExpr},${numArgs},${superSend});*/`);
        this.source.push(`throw{message:"Not yet implemented: full send ${debugSel} to " + VM.jitInstName(${rcvrVar})}`);
        this.isLeaf = false;
    },
    generateClosureTemps: function(count, popValues) {
        if (this.debug) this.generateDebugCode("closure temps");
        this.generateLabel();
        if (popValues) {
            var args = [];
            for (var i = 0; i < count; i++) args.unshift(this.pop());
            this.source.push(`${this.push()}=VM.jitArray([${args}]);\n`);
        } else {
            this.source.push(`${this.push()}=VM.jitArrayN(${count});\n`);
        }
    },
    generateClosureCopy: function(numArgs, numCopied, blockSize) {
        var from = this.pc,
            to = from + blockSize;
        if (this.debug) this.generateDebugCode("push closure(" + from + "-" + (to-1) + "): " + numCopied + " copied, " + numArgs + " args");
        // this.generateLabel();
        this.sp -= numCopied - 1;
        this.generateUnimplemented("closure copy");
        if (to > this.endPC) this.endPC = to;
    },
    generateStorePrimFailCode: function(index) {
        if (this.debug) this.generateDebugCode("store primitive fail code " + index);
        this.generateLabel();
        this.source.push(`if(VM.primFailCode!==0)t0=VM.jitPrimFail();\n`);
    },
    genUnlessLeaf: function(code) {
        this.nonLeafCode.push(this.source.length);
        this.source.push(code);
    },
    generateDirty: function(target, arg) {
        switch(target) {
            case "i[": this.source.push("r.dirty=true;"); break;
            case "L[": this.source.push("L[", arg, "].dirty=true;"); break;
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
                case 'N': this.source.push('nil'); break;
                case 'T': this.source.push('true'); break;
                case 'F': this.source.push('false'); break;
                case 'r': this.source.push('self'); break;
                case 'i[':
                    if (!this.instVarNames) this.source.push('inst var ', arg1);
                    else this.source.push(this.instVarNames[arg1]);
                    break;
                case 't':
                    this.source.push('temp ', arg1);
                    if (suffix1 !== '') this.source.push('[', arg2, ']');
                    break;
                case 'L[':
                    var lit = this.method.pointers[arg1];
                    if (suffix1 === ']') this.source.push(("literal "+lit).replace(/[\r\n]/g, c => c === "\r" ? "\\r" : "\\n"));
                    else this.source.push("literal ", lit.pointers[0].bytesAsString());
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
        const sp = this.PCtoSP[pc];
        this.generateLabel();
        this.source.push(`pc=${pc};sp=${sp};throw {message: "Not yet implemented: ${command}`);
        this.isLeaf = false; // throws
        // append argument
        if (what) {
            this.source.push(" ");
            switch (what) {
                case 'N': this.source.push('nil'); break;
                case 'T': this.source.push('true'); break;
                case 'F': this.source.push('false'); break;
                case 'r': this.source.push('self'); break;
                case 'i[': this.source.push('inst var ', arg1); break;
                case 't':
                    this.source.push('temp ', arg1);
                    if (suffix1 !== '') this.source.push('[', arg2, ']');
                    break;
                case 'L[':
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
        // delete initial comma from first var
        for (var i = 0; i < this.optionalVars.length; i++) {
            var v = this.optionalVars[i];
            if (!this.needsVar[v])
                this.source[this.sourcePos[v]] = "";
        }
        // delete initial comma from first var
        var p = this.sourcePos['vars'];
        while (!this.source[p]) p++;
        this.source[p] = this.source[p].slice(1);
    },
    deleteNonLeafCode: function() {
        for (var i = 0; i < this.nonLeafCode.length; i++) {
            this.source[this.nonLeafCode[i]] = "";
        }
    },
});
