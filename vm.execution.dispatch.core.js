/* c8 ignore file */
"use strict";

export function dispatchClassic(vm, helpers, singleStep) {
    var Squeak = vm.Squeak; // avoid dynamic lookup of "Squeak" in Lively
    if (vm._vmdbgEnabledParser && vm._vmdbgEnabledParser()) {
        try {
            var nxt = vm.nextSendSelector && vm.nextSendSelector();
            if (nxt && (nxt === 'charCode' || nxt === 'typeTableAt:' || nxt === 'scanToken' || nxt === 'scanTokens:' || nxt === 'next')) {
                var sendInfo = vm.findSendBeforePC(vm.method, vm.pc + 1) || {argCount: 0};
                var nArgs = typeof sendInfo.argCount === "number" ? sendInfo.argCount : 0;
                var rcvr = vm.stackValue(nArgs);
                var args = [];
                for (var ai = nArgs - 1; ai >= 0; ai--) args.push(vm.stackValue(ai));
                var mClass = (vm.method && vm.method.methodClass && vm.method.methodClass().className) ? vm.method.methodClass().className() : null;
                function clsName(vm, obj) {
                    try {
                        var c = vm.getClass ? vm.getClass(obj) : null;
                        return c && c.className ? c.className() : null;
                    } catch(_) { return null; }
                }
                var rcvrClass = clsName(vm, rcvr);
                var argClasses = [];
                for (var k = 0; k < args.length; k++) argClasses.push(clsName(vm, args[k]));
                if (vm._vmdbgLogParser) vm._vmdbgLogParser({site:"send", selector:nxt, pc:vm.pc, methodClass:mClass, rcvrClass:rcvrClass, argClasses:argClasses});
            }
        } catch(_) {}
    }
    var b, b2;
    vm.byteCodeCount++;
    b = vm.nextByte();
    helpers.beforeOpcode(b, singleStep);
    /* c8 ignore start */
    switch (b) { /* The Main V3 Bytecode Dispatch Loop */

        // load receiver variable
        case 0x00: case 0x01: case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07:
        case 0x08: case 0x09: case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x0E: case 0x0F:
            vm.push(vm.receiver.pointers[b&0xF]); return;

        // load temporary variable
        case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17:
        case 0x18: case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: case 0x1F:
            vm.push(vm.homeContext.pointers[Squeak.Context_tempFrameStart+(b&0xF)]); return;

        // loadLiteral
        case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25: case 0x26: case 0x27:
        case 0x28: case 0x29: case 0x2A: case 0x2B: case 0x2C: case 0x2D: case 0x2E: case 0x2F:
        case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35: case 0x36: case 0x37:
        case 0x38: case 0x39: case 0x3A: case 0x3B: case 0x3C: case 0x3D: case 0x3E: case 0x3F:
            vm.push(vm.method.methodGetLiteral(b&0x1F)); return;

        // loadLiteralIndirect
        case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x47:
        case 0x48: case 0x49: case 0x4A: case 0x4B: case 0x4C: case 0x4D: case 0x4E: case 0x4F:
        case 0x50: case 0x51: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56: case 0x57:
        case 0x58: case 0x59: case 0x5A: case 0x5B: case 0x5C: case 0x5D: case 0x5E: case 0x5F:
            vm.push((vm.method.methodGetLiteral(b&0x1F)).pointers[Squeak.Assn_value]); return;

        // storeAndPop rcvr, temp
        case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66: case 0x67:
            vm.receiver.dirty = true;
            vm.receiver.pointers[b&7] = vm.pop(); return;
        case 0x68: case 0x69: case 0x6A: case 0x6B: case 0x6C: case 0x6D: case 0x6E: case 0x6F:
            vm.homeContext.pointers[Squeak.Context_tempFrameStart+(b&7)] = vm.pop(); return;

        // Quick push
        case 0x70: vm.push(vm.receiver); return;
        case 0x71: vm.push(vm.trueObj); return;
        case 0x72: vm.push(vm.falseObj); return;
        case 0x73: vm.push(vm.nilObj); return;
        case 0x74: vm.push(-1); return;
        case 0x75: vm.push(0); return;
        case 0x76: vm.push(1); return;
        case 0x77: vm.push(2); return;

        // Quick return
        case 0x78: vm.doReturn(vm.receiver); return;
        case 0x79: vm.doReturn(vm.trueObj); return;
        case 0x7A: vm.doReturn(vm.falseObj); return;
        case 0x7B: vm.doReturn(vm.nilObj); return;
        case 0x7C: vm.doReturn(vm.pop()); return;
        case 0x7D: vm.doReturn(vm.pop(), vm.activeContext.pointers[Squeak.BlockContext_caller]); return; // blockReturn
        case 0x7E: vm.nono(); return;
        case 0x7F: vm.nono(); return;
        // Sundry
        case 0x80: vm.extendedPush(vm.nextByte()); return;
        case 0x81: vm.extendedStore(vm.nextByte()); return;
        case 0x82: vm.extendedStorePop(vm.nextByte()); return;
        // singleExtendedSend
        case 0x83: b2 = vm.nextByte(); helpers.send(vm.method.methodGetSelector(b2&31), b2>>5, false); return;
        case 0x84: vm.doubleExtendedDoAnything(vm.nextByte()); return;
        // singleExtendedSendToSuper
        case 0x85: b2= vm.nextByte(); helpers.send(vm.method.methodGetSelector(b2&31), b2>>5, true); return;
        // secondExtendedSend
        case 0x86: b2= vm.nextByte(); helpers.send(vm.method.methodGetSelector(b2&63), b2>>6, false); return;
        case 0x87: vm.pop(); return;  // pop
        case 0x88: vm.push(vm.top()); return;   // dup
        // thisContext
        case 0x89: vm.push(vm.exportThisContext()); return;

        // Closures
        case 0x8A: vm.pushNewArray(vm.nextByte());   // create new temp vector
            return;
        case 0x8B: helpers.callPrimitive(0x81);
            return;
        case 0x8C: b2 = vm.nextByte(); // remote push from temp vector
            vm.push(vm.homeContext.pointers[Squeak.Context_tempFrameStart+vm.nextByte()].pointers[b2]);
            return;
        case 0x8D: b2 = vm.nextByte(); // remote store into temp vector
            var vec = vm.homeContext.pointers[Squeak.Context_tempFrameStart+vm.nextByte()];
            vec.pointers[b2] = vm.top();
            vec.dirty = true;
            return;
        case 0x8E: b2 = vm.nextByte(); // remote store and pop into temp vector
            var vec = vm.homeContext.pointers[Squeak.Context_tempFrameStart+vm.nextByte()];
            vec.pointers[b2] = vm.pop();
            vec.dirty = true;
            return;
        case 0x8F: vm.pushClosureCopy(); return;

        // Short jmp
        case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97:
            vm.pc += (b&7)+1; return;
        // Short conditional jump on false
        case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F:
            vm.jumpIfFalse((b&7)+1); return;
        // Long jump, forward and back
        case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xA7:
            b2 = vm.nextByte();
            vm.pc += (((b&7)-4)*256 + b2);
            if ((b&7)<4)        // check for process switch on backward jumps (loops)
                if (vm.interruptCheckCounter-- <= 0) vm.checkForInterrupts();
            return;
        // Long conditional jump on true
        case 0xA8: case 0xA9: case 0xAA: case 0xAB:
            vm.jumpIfTrue((b&3)*256 + vm.nextByte()); return;
        // Long conditional jump on false
        case 0xAC: case 0xAD: case 0xAE: case 0xAF:
            vm.jumpIfFalse((b&3)*256 + vm.nextByte()); return;

        // Arithmetic Ops... + - < > <= >= = ~=    * /  @ lshift: lxor: land: lor:
        case 0xB0: vm.success = true; vm.resultIsFloat = false;
            if (!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) + vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // PLUS +
        case 0xB1: vm.success = true; vm.resultIsFloat = false;
            if (!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) - vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // MINUS -
        case 0xB2: vm.success = true;
            if (!vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) < vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // LESS <
        case 0xB3: vm.success = true;
            if (!vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) > vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // GRTR >
        case 0xB4: vm.success = true;
            if (!vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) <= vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // LEQ <=
        case 0xB5: vm.success = true;
            if (!vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) >= vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // GEQ >=
        case 0xB6: vm.success = true;
            if (!vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) === vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // EQU =
        case 0xB7: vm.success = true;
            if (!vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) !== vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // NEQ ~=
        case 0xB8: vm.success = true; vm.resultIsFloat = false;
            if (!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) * vm.stackIntOrFloat(0))) helpers.sendSpecial(b&0xF); return;  // TIMES *
        case 0xB9: vm.success = true;
            if (!vm.pop2AndPushIntResult(vm.quickDivide(vm.stackInteger(1),vm.stackInteger(0)))) helpers.sendSpecial(b&0xF); return;  // Divide /
        case 0xBA: vm.success = true;
            if (!vm.pop2AndPushIntResult(vm.mod(vm.stackInteger(1),vm.stackInteger(0)))) helpers.sendSpecial(b&0xF); return;  // MOD \
        case 0xBB: vm.success = true;
            if (!vm.primHandler.primitiveMakePoint(1, true)) helpers.sendSpecial(b&0xF); return;  // MakePt int@int
        case 0xBC: vm.success = true;
            if (!vm.pop2AndPushIntResult(vm.safeShift(vm.stackInteger(1),vm.stackInteger(0)))) helpers.sendSpecial(b&0xF); return; // bitShift:
        case 0xBD: vm.success = true;
            if (!vm.pop2AndPushIntResult(vm.div(vm.stackInteger(1),vm.stackInteger(0)))) helpers.sendSpecial(b&0xF); return;  // Divide //
        case 0xBE: vm.success = true;
            if (!vm.pop2AndPushIntResult(vm.stackInteger(1) & vm.stackInteger(0))) helpers.sendSpecial(b&0xF); return; // bitAnd:
        case 0xBF: vm.success = true;
            if (!vm.pop2AndPushIntResult(vm.stackInteger(1) | vm.stackInteger(0))) helpers.sendSpecial(b&0xF); return; // bitOr:

        // at:, at:put:, size, next, nextPut:, ...
        case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5: case 0xC6: case 0xC7:
        case 0xC8: case 0xC9: case 0xCA: case 0xCB: case 0xCC: case 0xCD: case 0xCE: case 0xCF:
            if (!helpers.quickSendOther(vm.receiver, b&0xF))
                helpers.sendSpecial((b&0xF)+16); return;

        // Send Literal Selector with 0, 1, and 2 args
        case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7:
        case 0xD8: case 0xD9: case 0xDA: case 0xDB: case 0xDC: case 0xDD: case 0xDE: case 0xDF:
            helpers.send(vm.method.methodGetSelector(b&0xF), 0, false); return;
        case 0xE0: case 0xE1: case 0xE2: case 0xE3: case 0xE4: case 0xE5: case 0xE6: case 0xE7:
        case 0xE8: case 0xE9: case 0xEA: case 0xEB: case 0xEC: case 0xED: case 0xEE: case 0xEF:
            helpers.send(vm.method.methodGetSelector(b&0xF), 1, false); return;
        case 0xF0: case 0xF1: case 0xF2: case 0xF3: case 0xF4: case 0xF5: case 0xF6: case 0xF7:
        case 0xF8: case 0xF9: case 0xFA: case 0xFB: case 0xFC: case 0xFD: case 0xFE: case 0xFF:
            helpers.send(vm.method.methodGetSelector(b&0xF), 2, false); return;
    }
    /* c8 ignore stop */
    throw Error("not a bytecode: " + b);
  }
