"use strict";
/*
 * Copyright (c) 2013-2020 Vanessa Freudenberg
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

Squeak.InstructionStream.subclass('Squeak.InstructionStreamSista',
'decoding', {
    interpretNextInstructionFor: function(client, extA=0, extB=0) {
        var Squeak = this.Squeak; // avoid dynamic lookup of "Squeak" in Lively
        // Send to the argument, client, a message that specifies the type of the next instruction.
        var b = this.method.bytes[this.pc++];
        switch (b) {
            
            case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17:
            case 0x18: case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: case 0x1F:
                return client.pushLiteralVariable(this.method.methodGetLiteral(b&0xF));
            
            case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x47:
            case 0x48: case 0x49: case 0x4A: case 0x4B:
                return client.pushTemporaryVariable(b&0xF);
            case 0x4C: return client.pushReceiver();
            case 0x4D: return client.pushConstant(this.vm.trueObj);
            case 0x4E: return client.pushConstant(this.vm.falseObj);
            case 0x4F: return client.pushConstant(this.vm.nilObj);
            case 0x50: return client.pushConstant(0);
            case 0x51: return client.pushConstant(1);
            case 0x52: return client.pushActiveContext();
            case 0x53: return client.doDup();
            case 0x58: return client.methodReturnReceiver();
            case 0x59: return client.methodReturnConstant(this.vm.trueObj);
            case 0x5A: return client.methodReturnConstant(this.vm.falseObj);
            case 0x5B: return client.methodReturnConstant(this.vm.nilObj);
            case 0x5C: return client.methodReturnTop();
            case 0x5D: return client.blockReturnConstant(this.vm.nilObj);
            case 0x5E: if (extA===0) return client.blockReturnTop(); else break;
            case 0x5F: return; // nop
            case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66: case 0x67:
            case 0x68: case 0x69: case 0x6A: case 0x6B: case 0x6C: case 0x6D: case 0x6E: case 0x6F:
            case 0x70: case 0x71: case 0x72: case 0x73: case 0x74: case 0x75: case 0x76: case 0x77:
            case 0x78: case 0x79: case 0x7A: case 0x7B: case 0x7C: case 0x7D: case 0x7E: case 0x7F:
                return client.send(this.vm.specialSelectors[2 * (b - 0x60)],
                    this.vm.specialSelectors[2 * (b - 0x60) + 1], false);


            case 0x80: case 0x81: case 0x82: case 0x83: case 0x84: case 0x85: case 0x86: case 0x87:
            case 0x88: case 0x89: case 0x8A: case 0x8B: case 0x8C: case 0x8D: case 0x8E: case 0x8F:
                return client.send(this.method.methodGetLiteral(b&0xF), 0, false);
            case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97:
            case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F:
                return client.send(this.method.methodGetLiteral(b&0xF), 1, false);
            case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xA7:
            case 0xA8: case 0xA9: case 0xAA: case 0xAB: case 0xAC: case 0xAD: case 0xAE: case 0xAF:
                return client.send(this.method.methodGetLiteral(b&0xF), 2, false);
                    
                    
            case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7:
                return client.popIntoTemporaryVariable(b - 0xD0);

            case 0xD8: return client.doPop();
        }
        var b2 = this.method.bytes[this.pc++];    
        switch (b) {
            case 0xE0: return this.interpretNextInstructionFor(client, (extA << 8) + b2, extB); 
            case 0xE1: return this.interpretNextInstructionFor(client, extA, (extB << 8) + (b2 < 128 ? b2 : b2-256));
                
                
            case 0xE8: return client.pushConstant(b2 + (extB << 8));
            
        }
        var b3 = this.method.bytes[this.pc++];    
        switch (b) {
            case 0xF8: return client.callPrimitive(b2 + (b3 << 8));
        }
        throw Error(`Unknown bytecode ${b}`);
    }
});
