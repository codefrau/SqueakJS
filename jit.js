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
'initialization', {
    initialize: function(vm) {
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
    },
},
'accessing', {
    compile: function(method) {
        if (method.compiled === undefined) {
            // 1st time
            method.compiled = false;
        } else {
            // 2nd time
            method.compiled = new Function('vm', this.generate(method));
        }
    },
    enableSingleStepping: function(method) {
        // recompile method for single-stepping
        if (!method.compiled || !method.compiled.canSingleStep) {
            var source = this.generate(method, true);
            method.compiled = new Function('vm', 'singleStep', source);
            method.compiled.canSingleStep = true;
        }
        // if a compiler does not support single-stepping, return false
        return true;
    },
},
'generating',
{
    generate: function(method, singleStep) {
        this.singleStep = !!singleStep;
        this.debug = this.singleStep || true;   // or true only while debugging
        this.method = method;
        this.pc = 0;                // next bytecode
        this.endPC = 0;             // pc of furthest jump target
        this.instructionStart = 0;  // pc at start of current instruction
        this.source = [];           // snippets will be joined in the end
        this.sourceLabels = {};     // source pos of generated labels 
        this.needsLabel = {0: true}; // jump targets
        this.source.push(
            "var context = vm.activeContext,\n",
            "    ctx = context.pointers,\n",
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
                        case 0x7C: this.generateReturn("ctx[vm.sp]"); break;
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
        if (this.singleStep) {
            if (this.debug) this.source.push("// all valid PCs have a label;\n");
            this.source.push("default: throw Error('invalid PC'); }"); // all PCs handled
        } else {
            if (this.debug) this.source.push("// fall back to single-stepping\n");
            this.source.push("default: return bytecodes + vm.pc + vm.interpretOne(true); }");
            this.deleteUnneededLabels();
        }
        return this.source.join(""); 
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
        	    this.generateInstruction("dup", "var dup = ctx[vm.sp]; ctx[++vm.sp] = dup;");
        	    return;
        	// thisContext
        	case 0x89:
        	    this.generateInstruction("thisContext", "ctx[++vm.sp] = context;\nvm.reclaimableContextCount = 0");
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
    generatePush: function(prefix, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugInfo("push");
        this.generateLabel();
        this.source.push("ctx[++vm.sp] = ", prefix);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(";\n");
    },
    generateStoreInto: function(prefix, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugInfo("store into");
        this.generateLabel();
        this.source.push(prefix);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = ctx[vm.sp];\n");
    },
    generatePopInto: function(prefix, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugInfo("pop into");
        this.generateLabel();
        this.source.push(prefix);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = ctx[vm.sp--];\n");
    },
    generateReturn: function(what) {
        if (this.debug) this.generateDebugInfo("return");
        this.generateLabel();
        this.source.push(
            "vm.pc = ", this.pc, ";\nvm.doReturn(", what, ");\nreturn bytecodes + ", this.pc, ";\n");
        this.done = this.pc > this.endPC;
    },
    generateBlockReturn: function() {
        if (this.debug) this.generateDebugInfo("block return");
        this.generateLabel();
        this.source.push(
            "vm.pc = ", this.pc, ";\nvm.doReturn(ctx[vm.sp--], ctx[0]);\nreturn bytecodes + ", this.pc, ";\n");
    },
    generateJump: function(distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugInfo("jump to " + destination);
        this.generateLabel();
        this.source.push("vm.pc = ", destination, ";\n");
        if (distance < 0) this.source.push(
            "if (vm.interruptCheckCounter-- <= 0) {\n",
            "   vm.checkForInterrupts();\n",
            "   if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n",
            "}\nbytecodes += ", -distance, ";\n");
        else this.source.push("bytecodes -= ", distance, ";\n"); 
        if (this.singleStep) this.source.push("if (singleStep) return bytecodes + ", this.pc,";\n");
        this.source.push("continue;\n");
        this.needsLabel[destination] = true;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateJumpIf: function(condition, distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugInfo("jump if " + condition + " to " + destination);
        this.generateLabel();
        this.source.push(
            "var cond = ctx[vm.sp--]; if (cond === vm.", condition, "Obj) {vm.pc = ", destination, "; bytecodes -= ", distance, "; ");
        if (this.singleStep) this.source.push("if (singleStep) return bytecodes + ", this.pc,"; else ");
        this.source.push("continue}\n",
            "else if (cond !== vm.", !condition, "Obj) {vm.sp++; vm.pc = ", this.pc, "; vm.send(vm.specialObjects[25], 1, false); return bytecodes + ", this.pc, "}\n");
        this.needsLabel[this.pc] = true;
        this.needsLabel[destination] = true;
        if (destination > this.endPC) this.endPC = destination;
    }
,
    generateQuickPrim: function(byte) {
        if (this.debug) this.generateDebugInfo("quick prim " + this.specialSelectors[(byte & 0x0F) + 16]);
        this.generateLabel();
        switch (byte) {
            //case 0xC0: return this.popNandPushIfOK(2, this.objectAt(true,true,false)); // at:
            //case 0xC1: return this.popNandPushIfOK(3, this.objectAtPut(true,true,false)); // at:put:
            case 0xC2: // size
                this.source.push(
                    "if (ctx[vm.sp].sqClass === vm.specialObjects[7]) ctx[vm.sp] = ctx[vm.sp].pointersSize();\n",
                    "else if (ctx[vm.sp].sqClass === vm.specialObjects[6]) ctx[vm.sp] = ctx[vm.sp].bytesSize();\n",
                    "else { vm.pc = ", this.pc, "; vm.sendSpecial(18); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "; }\n"); 
                this.needsLabel[this.pc] = true;
                return;
            //case 0xC3: return false; // next
            //case 0xC4: return false; // nextPut:
            //case 0xC5: return false; // atEnd
            case 0xC6: // ==
                this.source.push("var cond = ctx[vm.sp-1] === ctx[vm.sp];\nctx[--vm.sp] = cond ? vm.trueObj : vm.falseObj;\n");
                return;
            case 0xC7: // class
                this.source.push("ctx[vm.sp] = typeof ctx[vm.sp] === 'number' ? vm.specialObjects[5] : ctx[vm.sp].sqClass;\n");
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
        this.source.push(
            "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), "))",
            " vm.sendSpecial(", ((byte & 0x0F) + 16), ");\n",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n",
            "if (vm.pc !== ", this.pc, ") throw Error('Huh?');\n");
        this.needsLabel[this.pc] = true;
    },
    generateNumericOp: function(byte) {
        if (this.debug) this.generateDebugInfo("numeric op " + this.specialSelectors[byte & 0x0F]);
        this.generateLabel();
        this.needsLabel[this.pc] = true;
        switch (byte) {
            case 0xB0: // PLUS +
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a + b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(0); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB1: // MINUS -
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a - b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(1); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB2: // LESS <
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = a < b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(2); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB3: // GRTR >
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = a > b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(3); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB4: // LEQ <=
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = a <= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(4); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB5: // GEQ >=
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = a >= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(5); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB6: // EQU =
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = a === b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b) {\n",
                "   ctx[--vm.sp] = vm.trueObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(6); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB7: // NEQ ~=
                this.source.push("var a = ctx[vm.sp - 1], b = ctx[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   ctx[--vm.sp] = a !== b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b) {\n",
                "   ctx[--vm.sp] = vm.falseObj;\n",
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
        if (this.debug) this.generateDebugInfo("send " + (prefix === "lit[" ? this.method.pointers[num].bytesAsString() : "..."));
        this.generateLabel();
        this.source.push(
            "vm.pc = ", this.pc, ";\n",
            "vm.send(", prefix, num, suffix, ", ", numArgs, ", ", superSend, ");\n",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n");
        this.needsLabel[this.pc] = true;
    },
    generateClosureTemps: function(count, popValues) {
        if (this.debug) this.generateDebugInfo("closure temps");
        this.generateLabel();
        this.source.push("var array = vm.instantiateClass(vm.specialObjects[7], ", count, ");\n");
        if (popValues) {
            for (var i = 0; i < count; i++)
                this.source.push("array.pointers[", i, "] = ctx[vm.sp - ", count - i - 1,"];\n");
            this.source.push("ctx[vm.sp -= ", count - 1,"] = array;\n");
        } else {
            this.source.push("ctx[++vm.sp] = array;\n");
        }
    },
    generateClosureCopy: function(numArgs, numCopied, blockSize) {
        var from = this.pc,
            to = from + blockSize;  // encodeSqueakPC
        if (this.debug) this.generateDebugInfo("push closure(" + from + "-" + (to-1) + "): " + numArgs + " args, " + numCopied + " captured");
        this.generateLabel();
        this.source.push(
            "var closure = vm.instantiateClass(vm.specialObjects[36], ", numCopied + 3, ");\n",
            "closure.pointers[0] = context; vm.reclaimableContextCount = 0;\n",
            "closure.pointers[1] = ", from + this.method.pointers.length * 4 + 1, ";\n",  // encodeSqueakPC
            "closure.pointers[2] = ", numArgs, ";\n");
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                this.source.push("closure.pointers[", i + 3, "] = ctx[vm.sp - ", numCopied - i - 1,"];\n");
            this.source.push("ctx[vm.sp -= ", numCopied - 1,"] = closure;\n");
        } else {
            this.source.push("ctx[++vm.sp] = closure;\n");
        }
        this.source.push("vm.pc = ", to, ";\n");
        this.source.push("bytecodes -= ", blockSize, ";\n"); 
        if (this.singleStep) this.source.push("if (singleStep) return bytecodes + ", this.pc,";\n");
        this.source.push("continue;\n");
        this.needsLabel[from] = true;
        this.needsLabel[to] = true;
    	if (to > this.endPC) this.endPC = to;
    },
    generateLabel: function() {
        this.sourceLabels[this.instructionStart] = this.source.length;
        this.source.push("case ", this.instructionStart, ":\n");
        this.instructionStart = this.pc;
    },
    generateDebugInfo: function(comment) {
        // single-step for previous instructiuon
        if (this.singleStep && this.instructionStart > 0) {
             this.source.push("if (singleStep || vm.breakOutOfInterpreter !== false) {vm.pc = ", this.instructionStart, "; return bytecodes + ", this.instructionStart, "}\n");
             this.needsLabel[this.instructionStart] = true;
        }
        // comment for this instructiuon
        var bytecodes = [];
        for (var i = this.instructionStart; i < this.pc; i++)
            bytecodes.push((this.method.bytes[i] + 0x100).toString(16).slice(-2).toUpperCase());
        this.source.push("// ", this.instructionStart, " <", bytecodes.join(" "), "> ", comment, "\n");
    },
    generateInstruction: function(comment, instr) {
        if (this.debug) this.generateDebugInfo(comment); 
        this.generateLabel();
        this.source.push(instr, ";\n");
    },
    deleteUnneededLabels: function() {
        for (var i in this.sourceLabels) 
            if (this.sourceLabels[i] && !this.needsLabel[i])
                for (var j = 0; j < 3; j++) 
                    this.source[this.sourceLabels[i] + j] = "";
    },
});

}) // end of module
