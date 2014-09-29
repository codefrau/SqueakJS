module('users.bert.SqueakJS.jit').requires("users.bert.SqueakJS.vm").toRun(function() {
/*
 * Copyright (c) 2014 Bert Freudenberg
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

    while (true) switch (vm.pc) {
    case 0:
        stack[++vm.sp] = inst[0];
        vm.pc = 2; vm.send(#selector);
        return 0;
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
        return 0;
    }

The compiled method should return the number of bytecodes executed, but for
statistical purposes only. It's fine to return 0.

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
        this.vm = vm;
        this.comments = !!Squeak.Compiler.comments, // generate comments
        // for debug-printing only
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
    },
},
'accessing', {
    compile: function(method, optClass, optSel) {
        if (!method.isHot) {
            // 1st time
            method.isHot = true;
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
            var clsAndSel = this.vm.printMethod(method, optClass, optSel).split(">>");    // likely expensive
            method.compiled = this.generate(method, clsAndSel[0], clsAndSel[1]);
            method.compiled.canSingleStep = true;
        }
        // if a compiler does not support single-stepping, return false
        return true;
    },
    functionNameFor: function(cls, sel) {
        if (!cls || !sel) return "Squeak_DOIT";
        if (!/[^a-zA-Z:_]/.test(sel))
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
'generating',
{
    generate: function(method, optClass, optSel) {
        this.method = method;
        this.pc = 0;                // next bytecode
        this.endPC = 0;             // pc of furthest jump target
        this.prevPC = 0;            // pc at start of current instruction
        this.source = [];           // snippets will be joined in the end
        this.sourceLabels = {};     // source pos of generated labels 
        this.needsLabel = {0: true}; // jump targets
        this.needsBreak = false;    // insert break check for previous bytecode
        if (optClass && optSel)
            this.source.push("// ", optClass, ">>", optSel, "\n");
        this.source.push(
            "var context = vm.activeContext,\n",
            "    stack = context.pointers,\n",
            "    rcvr = vm.receiver,\n",
            "    inst = rcvr.pointers,\n",
            "    temp = vm.homeContext.pointers,\n",
            "    lit = vm.method.pointers,\n",
            "    bytecodes = 0 - vm.pc;\n",
            "while (true) switch (vm.pc) {\n"
        );
        this.done = false;
        while (!this.done) {
            var byte = method.bytes[this.pc++],
                byte2 = 0;
            switch (byte & 0xF8) {
                // load receiver variable
                case 0x00: case 0x08:
                    this.generatePush("inst[", byte & 0x0F, "]");
                    break;
                // load temporary variable
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
                // storeAndPop rcvr
                case 0x60:
                    this.generatePopInto("inst[", byte & 0x07, "]"); 
                    break;
                // storeAndPop temp
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
        var funcName = this.functionNameFor(optClass, optSel);
        if (this.singleStep) {
            if (this.debug) this.source.push("// all valid PCs have a label;\n");
            this.source.push("default: throw Error('invalid PC'); }"); // all PCs handled
            return new Function("return function " + funcName + "(vm, singleStep) {\n" + this.source.join("") + "\n}")();
        } else {
            if (this.debug) this.source.push("// fall back to single-stepping\n");
            this.source.push("default: bytecodes += vm.pc; vm.interpretOne(true); return bytecodes;}");
            this.deleteUnneededLabels();
            return new Function("return function " + funcName + "(vm) {\n" + this.source.join("") + "\n}")();
        }
    },
    generateExtended: function(bytecode) {
        switch (bytecode) {
            // extended push
            case 0x80:
                var byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePush("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePush("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: this.generatePush("lit[", 1 + (byte2 & 0x3F), "]"); return;
                    case 3: this.generatePush("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
            // extended store
            case 0x81:
                var byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generateStoreInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generateStoreInto("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: throw Error("illegal store into literal");
                    case 3: this.generateStoreInto("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
                return;
            // extended pop into
            case 0x82:
                var byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePopInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePopInto("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: throw Error("illegal pop into literal");
                    case 3: this.generatePopInto("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
    			}
    		// Single extended send
    		case 0x83:
    		    var byte2 = this.method.bytes[this.pc++];
    		    this.generateSend("lit[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, false);
    		    return;
    		// Double extended do-anything
    		case 0x84:
    		    var byte2 = this.method.bytes[this.pc++];
    			var byte3 = this.method.bytes[this.pc++];
    			switch (byte2 >> 5) {
        			case 0: this.generateSend("lit[", 1 + byte3, "]", byte2 & 31, false); return;
        			case 1: this.generateSend("lit[", 1 + byte3, "]", byte2 & 31, true); return;
        			case 2: this.generatePush("inst[", byte3, "]"); return;
        			case 3: this.generatePush("lit[", 1 + byte3, "]"); return;
        			case 4: this.generatePush("lit[", 1 + byte3, "].pointers[1]"); return;
        			case 5: this.generateStoreInto("inst[", byte3, "]"); return;
        			case 6: this.generatePopInto("inst[", byte3, "]"); return;
        			case 7: this.generateStoreInto("lit[", 1 + byte3, "]"); return;
    			}
    		// Single extended send to super
    	    case 0x85:
    	        var byte2 = this.method.bytes[this.pc++];
    	        this.generateSend("lit[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, true);
    	        return;
    	    // Second extended send
    		case 0x86:
    		     var byte2 = this.method.bytes[this.pc++];
        		 this.generateSend("lit[", 1 + (byte2 & 0x3F), "]", byte2 >> 6, false);
        		 return;
        	// pop
        	case 0x87:
        	    this.generateInstruction("pop", "vm.sp--");
        	    return;
        	// dup
        	case 0x88:
        	    this.generateInstruction("dup", "var dup = stack[vm.sp]; stack[++vm.sp] = dup;");
        	    return;
        	// thisContext
        	case 0x89:
        	    this.generateInstruction("thisContext", "stack[++vm.sp] = context;\nvm.reclaimableContextCount = 0");
        	    return;
            // closures
            case 0x8A:
                var byte2 = this.method.bytes[this.pc++],
                    popValues = byte2 > 127,
                    count = byte2 & 127;
                this.generateClosureTemps(count, popValues);
                return;
            case 0x8B:
                throw Error("unusedBytecode");
            // remote push from temp vector
            case 0x8C:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                this.generatePush("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // remote store into temp vector
            case 0x8D:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                this.generateStoreInto("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // remote store and pop into temp vector
            case 0x8E:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                this.generatePopInto("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // pushClosureCopy
            case 0x8F:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                var byte4 = this.method.bytes[this.pc++];
                var numArgs = byte2 & 0xF,
                    numCopied = byte2 >> 4,
                    blockSize = byte3 << 8 | byte4;
                this.generateClosureCopy(numArgs, numCopied, blockSize);
                return;
    	}
    },
    generatePush: function(value, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("push");
        this.generateLabel();
        this.source.push("stack[++vm.sp] = ", value);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(";\n");
    },
    generateStoreInto: function(value, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("store into");
        this.generateLabel();
        this.source.push(value);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = stack[vm.sp];\n");
    },
    generatePopInto: function(value, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("pop into");
        this.generateLabel();
        this.source.push(value);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = stack[vm.sp--];\n");
    },
    generateReturn: function(what) {
        if (this.debug) this.generateDebugCode("return");
        this.generateLabel();
        this.source.push(
            "vm.pc = ", this.pc, ";\nvm.doReturn(", what, ");\nreturn bytecodes + ", this.pc, ";\n");
        this.needsBreak = false; // returning anyway
        this.done = this.pc > this.endPC;
    },
    generateBlockReturn: function() {
        if (this.debug) this.generateDebugCode("block return");
        this.generateLabel();
        // actually stack === context.pointers but that would look weird
        this.source.push(
            "vm.pc = ", this.pc, ";\nvm.doReturn(stack[vm.sp--], context.pointers[0]);\nreturn bytecodes + ", this.pc, ";\n");
        this.needsBreak = false; // returning anyway
    },
    generateJump: function(distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump to " + destination);
        this.generateLabel();
        this.source.push("vm.pc = ", destination, ";\n");
        if (distance < 0) this.source.push(
            "if (vm.interruptCheckCounter-- <= 0) {\n",
            "   vm.checkForInterrupts();\n",
            "   if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n",
            "}\nbytecodes += ", -distance, ";\n");
        else this.source.push("bytecodes -= ", distance, ";\n"); 
        if (this.singleStep) this.source.push("if (vm.breakOutOfInterpreter) return bytecodes + ", this.pc,"; // single-step\n");
        this.source.push("continue;\n");
        this.needsBreak = false; // already checked
        this.needsLabel[destination] = true;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateJumpIf: function(condition, distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump if " + condition + " to " + destination);
        this.generateLabel();
        this.source.push(
            "var cond = stack[vm.sp--]; if (cond === vm.", condition, "Obj) {vm.pc = ", destination, "; bytecodes -= ", distance, "; ");
        if (this.singleStep) this.source.push("if (vm.breakOutOfInterpreter) return bytecodes + ", this.pc,"; /* single-step */ else ");
        this.source.push("continue}\n",
            "else if (cond !== vm.", !condition, "Obj) {vm.sp++; vm.pc = ", this.pc, "; vm.send(vm.specialObjects[25], 1, false); return bytecodes + ", this.pc, "}\n");
        this.needsBreak = false; // already inserted above
        this.needsLabel[this.pc] = true; // for coming back after #mustBeBoolean send
        this.needsLabel[destination] = true; // obviously
        if (destination > this.endPC) this.endPC = destination;
    }
,
    generateQuickPrim: function(byte) {
        if (this.debug) this.generateDebugCode("quick prim " + this.specialSelectors[(byte & 0x0F) + 16]);
        this.generateLabel();
        switch (byte) {
            //case 0xC0: return this.popNandPushIfOK(2, this.objectAt(true,true,false)); // at:
            //case 0xC1: return this.popNandPushIfOK(3, this.objectAtPut(true,true,false)); // at:put:
            case 0xC2: // size
                this.source.push(
                    "if (stack[vm.sp].sqClass === vm.specialObjects[7]) stack[vm.sp] = stack[vm.sp].pointersSize();\n",
                    "else if (stack[vm.sp].sqClass === vm.specialObjects[6]) stack[vm.sp] = stack[vm.sp].bytesSize();\n",
                    "else { vm.pc = ", this.pc, "; vm.sendSpecial(18); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "; }\n"); 
                this.needsLabel[this.pc] = true;
                return;
            //case 0xC3: return false; // next
            //case 0xC4: return false; // nextPut:
            //case 0xC5: return false; // atEnd
            case 0xC6: // ==
                this.source.push("var cond = stack[vm.sp-1] === stack[vm.sp];\nstack[--vm.sp] = cond ? vm.trueObj : vm.falseObj;\n");
                return;
            case 0xC7: // class
                this.source.push("stack[vm.sp] = typeof stack[vm.sp] === 'number' ? vm.specialObjects[5] : stack[vm.sp].sqClass;\n");
                return;
            case 0xC8: // blockCopy:
                this.source.push(
                    "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), ")) ",
                    "{vm.sendSpecial(", ((byte & 0x0F) + 16), "); return bytecodes + ", this.pc, "}\n");
                this.needsLabel[this.pc] = true;        // for send
                this.needsLabel[this.pc + 2] = true;    // for start of block
                return;
            case 0xC9: // value
            case 0xCA: // value:
            case 0xCB: // do:
                this.source.push(
                    "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), ")) vm.sendSpecial(", ((byte & 0x0F) + 16), "); return bytecodes + ", this.pc, ";\n");
                this.needsLabel[this.pc] = true;
                return;
            //case 0xCC: return false; // new
            //case 0xCD: return false; // new:
            //case 0xCE: return false; // x
            //case 0xCF: return false; // y
        }
        // generic version for the bytecodes not yet handled above
        this.source.push(
            "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), "))",
            " vm.sendSpecial(", ((byte & 0x0F) + 16), ");\n",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n",
            "if (vm.pc !== ", this.pc, ") throw Error('Huh?');\n");
        this.needsBreak = false; // already checked
        // if falling back to a full send we need a label for coming back
        this.needsLabel[this.pc] = true;
    },
    generateNumericOp: function(byte) {
        if (this.debug) this.generateDebugCode("numeric op " + this.specialSelectors[byte & 0x0F]);
        this.generateLabel();
        // if the op cannot be executed here, do a full send and return to main loop
        // we need a label for coming back
        this.needsLabel[this.pc] = true;
        switch (byte) {
            case 0xB0: // PLUS +
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a + b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(0); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB1: // MINUS -
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a - b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(1); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB2: // LESS <
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a < b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(2); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB3: // GRTR >
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a > b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(3); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB4: // LEQ <=
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a <= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(4); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB5: // GEQ >=
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a >= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(5); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB6: // EQU =
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a === b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b) {\n",
                "   stack[--vm.sp] = vm.trueObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(6); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB7: // NEQ ~=
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a !== b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b) {\n",
                "   stack[--vm.sp] = vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(7); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB8: // TIMES *
                this.source.push("vm.success = true; vm.resultIsFloat = false; if(!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) * vm.stackIntOrFloat(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(8); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB9: // DIV /
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.quickDivide(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(9); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBA: // MOD \
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.mod(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(10); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBB:  // MakePt int@int
                this.source.push("vm.success = true; if(!vm.primHandler.primitiveMakePoint(1)) { vm.pc = ", this.pc, "; vm.sendSpecial(11); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBC: // bitShift:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.safeShift(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(12); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBD: // Divide //
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.div(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(13); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBE: // bitAnd:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.stackInteger(1) & vm.stackInteger(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(14); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBF: // bitOr:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.stackInteger(1) | vm.stackInteger(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(15); return bytecodes + ", this.pc, "}\n");
                return;
        }
    },
    generateSend: function(prefix, num, suffix, numArgs, superSend) {
        if (this.debug) this.generateDebugCode("send " + (prefix === "lit[" ? this.method.pointers[num].bytesAsString() : "..."));
        this.generateLabel();
        // set pc, activate new method, and return to main loop
        // unless the method was a successfull primitive call (no context change)
        this.source.push(
            "vm.pc = ", this.pc, ";\n",
            "vm.send(", prefix, num, suffix, ", ", numArgs, ", ", superSend, ");\n",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n");
        this.needsBreak = false; // already checked
        // need a label for coming back after send
        this.needsLabel[this.pc] = true;
    },
    generateClosureTemps: function(count, popValues) {
        if (this.debug) this.generateDebugCode("closure temps");
        this.generateLabel();
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
        if (this.debug) this.generateDebugCode("push closure(" + from + "-" + (to-1) + "): " + numArgs + " args, " + numCopied + " captured");
        this.generateLabel();
        this.source.push(
            "var closure = vm.instantiateClass(vm.specialObjects[36], ", numCopied + 3, ");\n",
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
        this.source.push("bytecodes -= ", blockSize, ";\n"); 
        if (this.singleStep) this.source.push("if (vm.breakOutOfInterpreter) return bytecodes + ", this.pc,"; // single-step\n");
        this.source.push("continue;\n");
        this.needsBreak = false; // already checked
        this.needsLabel[from] = true;   // initial pc when activated
        this.needsLabel[to] = true;     // for jump over closure
    	if (to > this.endPC) this.endPC = to;
    },
    generateLabel: function() {
        // remember label position for deleteUnneededLabels()
        this.sourceLabels[this.prevPC] = this.source.length;
        this.source.push("case ", this.prevPC, ":\n");
        this.prevPC = this.pc;
    },
    generateDebugCode: function(comment) {
        // single-step for previous instructiuon
        if (this.needsBreak) {
             this.source.push("if (vm.breakOutOfInterpreter) {vm.pc = ", this.prevPC, "; return bytecodes + ", this.prevPC, "} // single-step\n");
             this.needsLabel[this.prevPC] = true;
        }
        // comment for this instructiuon
        var bytecodes = [];
        for (var i = this.prevPC; i < this.pc; i++)
            bytecodes.push((this.method.bytes[i] + 0x100).toString(16).slice(-2).toUpperCase());
        this.source.push("// ", this.prevPC, " <", bytecodes.join(" "), "> ", comment, "\n");
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
        for (var i in this.sourceLabels) 
            if (!this.needsLabel[i])
                for (var j = 0; j < 3; j++) 
                    this.source[this.sourceLabels[i] + j] = "";
    },
});

}) // end of module
