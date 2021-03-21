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

Object.subclass('Squeak.Interpreter',
'initialization', {
    initialize: function(image, display) {
        console.log('squeak: initializing interpreter ' + Squeak.vmVersion);
        this.Squeak = Squeak;   // store locally to avoid dynamic lookup in Lively
        this.image = image;
        this.image.vm = this;
        this.primHandler = new Squeak.Primitives(this, display);
        this.loadImageState();
        this.hackImage();
        this.initVMState();
        this.loadInitialContext();
        this.initCompiler();
        console.log('squeak: ready');
    },
    loadImageState: function() {
        this.specialObjects = this.image.specialObjectsArray.pointers;
        this.specialSelectors = this.specialObjects[Squeak.splOb_SpecialSelectors].pointers;
        this.nilObj = this.specialObjects[Squeak.splOb_NilObject];
        this.falseObj = this.specialObjects[Squeak.splOb_FalseObject];
        this.trueObj = this.specialObjects[Squeak.splOb_TrueObject];
        this.hasClosures = this.image.hasClosures;
        this.globals = this.findGlobals();
        // hack for old image that does not support Unix files
        if (!this.hasClosures && !this.findMethod("UnixFileDirectory class>>pathNameDelimiter"))
            this.primHandler.emulateMac = true;
        // pre-release image has inverted colors
        if (this.image.version == 6501)
            this.primHandler.reverseDisplay = true;
    },
    initVMState: function() {
        this.byteCodeCount = 0;
        this.sendCount = 0;
        this.interruptCheckCounter = 0;
        this.interruptCheckCounterFeedBackReset = 1000;
        this.interruptChecksEveryNms = 3;
        this.nextPollTick = 0;
        this.nextWakeupTick = 0;
        this.lastTick = 0;
        this.interruptKeycode = 2094;  //"cmd-."
        this.interruptPending = false;
        this.pendingFinalizationSignals = 0;
        this.freeContexts = this.nilObj;
        this.freeLargeContexts = this.nilObj;
        this.reclaimableContextCount = 0;
        this.nRecycledContexts = 0;
        this.nAllocatedContexts = 0;
        this.methodCacheSize = 1024;
        this.methodCacheMask = this.methodCacheSize - 1;
        this.methodCacheRandomish = 0;
        this.methodCache = [];
        for (var i = 0; i < this.methodCacheSize; i++)
            this.methodCache[i] = {lkupClass: null, selector: null, method: null, primIndex: 0, argCount: 0, mClass: null};
        this.breakOutOfInterpreter = false;
        this.breakOutTick = 0;
        this.breakOnMethod = null; // method to break on
        this.breakOnNewMethod = false;
        this.breakOnContextChanged = false;
        this.breakOnContextReturned = null; // context to break on
        this.messages = {};
        this.startupTime = Date.now(); // base for millisecond clock
    },
    loadInitialContext: function() {
        var schedAssn = this.specialObjects[Squeak.splOb_SchedulerAssociation];
        var sched = schedAssn.pointers[Squeak.Assn_value];
        var proc = sched.pointers[Squeak.ProcSched_activeProcess];
        this.activeContext = proc.pointers[Squeak.Proc_suspendedContext];
        this.activeContext.dirty = true;
        this.fetchContextRegisters(this.activeContext);
        this.reclaimableContextCount = 0;
    },
    findGlobals: function() {
        var smalltalk = this.specialObjects[Squeak.splOb_SmalltalkDictionary],
            smalltalkClass = smalltalk.sqClass.className();
        if (smalltalkClass === "Association") {
            smalltalk = smalltalk.pointers[1];
            smalltalkClass = smalltalk.sqClass.className();
        }
        if (smalltalkClass === "SystemDictionary")
            return smalltalk.pointers[1].pointers;
        if (smalltalkClass === "SmalltalkImage") {
            var globals = smalltalk.pointers[0],
                globalsClass = globals.sqClass.className();
            if (globalsClass === "SystemDictionary")
                return globals.pointers[1].pointers;
            if (globalsClass === "Environment")
                return globals.pointers[2].pointers[1].pointers
        }
        console.warn("cannot find global dict");
        return [];
    },
    initCompiler: function() {
        if (!Squeak.Compiler)
            return console.warn("Squeak.Compiler not loaded, using interpreter only");
        // some JS environments disallow creating functions at runtime (e.g. FireFox OS apps)
        try {
            if (new Function("return 42")() !== 42)
                return console.warn("function constructor not working, disabling JIT");
        } catch (e) {
            return console.warn("disabling JIT: " + e);
        }
        // disable JIT on slow machines, which are likely memory-limited
        var kObjPerSec = this.image.oldSpaceCount / (this.startupTime - this.image.startupTime);
        if (kObjPerSec < 10)
            return console.warn("Slow machine detected (loaded " + (kObjPerSec*1000|0) + " objects/sec), using interpreter only");
        // compiler might decide to not handle current image
        try {
            console.log("squeak: initializing JIT compiler");
            this.compiler = new Squeak.Compiler(this);
        } catch(e) {
            console.warn("Compiler " + e);
        }
    },
    hackImage: function() {
        // hack methods to make work / speed up
        var returnSelf  = 256,
            returnTrue  = 257,
            returnFalse = 258,
            returnNil   = 259,
            opts = typeof location === 'object' ? location.hash : "";
        [
            // Etoys fallback for missing translation files is hugely inefficient.
            // This speeds up opening a viewer by 10x (!)
            // Remove when we added translation files.
            //{method: "String>>translated", primitive: returnSelf, enabled: true},
            //{method: "String>>translatedInAllDomains", primitive: returnSelf, enabled: true},
            // 64 bit Squeak does not flush word size on snapshot
            {method: "SmalltalkImage>>wordSize", literal: {index: 1, old: 8, hack: 4}, enabled: true},
            // Squeak 5.3 disable wizard by replacing #open send with pop
            {method: "ReleaseBuilder class>>prepareEnvironment", bytecode: {pc: 28, old: 0xD8, hack: 0x87}, enabled: opts.includes("wizard=false")},
        ].forEach(function(each) {
            try {
                var m = each.enabled && this.findMethod(each.method);
                if (m) {
                    var prim = each.primitive,
                        byte = each.bytecode,
                        lit = each.literal,
                        hacked = true;
                    if (prim) m.pointers[0] |= prim;
                    else if (byte && m.bytes[byte.pc] === byte.old) m.bytes[byte.pc] = byte.hack;
                    else if (byte && m.bytes[byte.pc] === byte.hack) hacked = false; // already there
                    else if (lit && m.pointers[lit.index].pointers[1] === lit.old) m.pointers[lit.index].pointers[1] = lit.hack;
                    else if (lit && m.pointers[lit.index].pointers[1] === lit.hack) hacked = false; // already there
                    else { hacked = false; console.error("Failed to hack " + each.method); }
                    if (hacked) console.warn("Hacking " + each.method);
                }
            } catch (error) {
                console.error("Failed to hack " + each.method + " with error " + error);
            }

        }, this);
    },
},
'interpreting', {
    interpretOne: function(singleStep) {
        if (this.method.methodSignFlag()) {
            return this.interpretOneSistaWithExtensions(singleStep, 0, 0);
        }
        if (this.method.compiled) {
            if (singleStep) {
                if (!this.compiler.enableSingleStepping(this.method)) {
                    this.method.compiled = null;
                    return this.interpretOne(singleStep);
                }
                this.breakNow();
            }
            this.method.compiled(this);
            return;
        }
        var Squeak = this.Squeak; // avoid dynamic lookup of "Squeak" in Lively
        var b, b2;
        this.byteCodeCount++;
        b = this.nextByte();
        switch (b) { /* The Main V3 Bytecode Dispatch Loop */

            // load receiver variable
            case 0x00: case 0x01: case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07:
            case 0x08: case 0x09: case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x0E: case 0x0F:
                this.push(this.receiver.pointers[b&0xF]); return;

            // load temporary variable
            case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17:
            case 0x18: case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: case 0x1F:
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&0xF)]); return;

            // loadLiteral
            case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25: case 0x26: case 0x27:
            case 0x28: case 0x29: case 0x2A: case 0x2B: case 0x2C: case 0x2D: case 0x2E: case 0x2F:
            case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35: case 0x36: case 0x37:
            case 0x38: case 0x39: case 0x3A: case 0x3B: case 0x3C: case 0x3D: case 0x3E: case 0x3F:
                this.push(this.method.methodGetLiteral(b&0x1F)); return;

            // loadLiteralIndirect
            case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x47:
            case 0x48: case 0x49: case 0x4A: case 0x4B: case 0x4C: case 0x4D: case 0x4E: case 0x4F:
            case 0x50: case 0x51: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56: case 0x57:
            case 0x58: case 0x59: case 0x5A: case 0x5B: case 0x5C: case 0x5D: case 0x5E: case 0x5F:
                this.push((this.method.methodGetLiteral(b&0x1F)).pointers[Squeak.Assn_value]); return;

            // storeAndPop rcvr, temp
            case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66: case 0x67:
                this.receiver.dirty = true;
                this.receiver.pointers[b&7] = this.pop(); return;
            case 0x68: case 0x69: case 0x6A: case 0x6B: case 0x6C: case 0x6D: case 0x6E: case 0x6F:
                this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&7)] = this.pop(); return;

            // Quick push
            case 0x70: this.push(this.receiver); return;
            case 0x71: this.push(this.trueObj); return;
            case 0x72: this.push(this.falseObj); return;
            case 0x73: this.push(this.nilObj); return;
            case 0x74: this.push(-1); return;
            case 0x75: this.push(0); return;
            case 0x76: this.push(1); return;
            case 0x77: this.push(2); return;

            // Quick return
            case 0x78: this.doReturn(this.receiver); return;
            case 0x79: this.doReturn(this.trueObj); return;
            case 0x7A: this.doReturn(this.falseObj); return;
            case 0x7B: this.doReturn(this.nilObj); return;
            case 0x7C: this.doReturn(this.pop()); return;
            case 0x7D: this.doReturn(this.pop(), this.activeContext.pointers[Squeak.BlockContext_caller]); return; // blockReturn
            case 0x7E: this.nono(); return;
            case 0x7F: this.nono(); return;
            // Sundry
            case 0x80: this.extendedPush(this.nextByte()); return;
            case 0x81: this.extendedStore(this.nextByte()); return;
            case 0x82: this.extendedStorePop(this.nextByte()); return;
            // singleExtendedSend
            case 0x83: b2 = this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, false); return;
            case 0x84: this.doubleExtendedDoAnything(this.nextByte()); return;
            // singleExtendedSendToSuper
            case 0x85: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, true); return;
            // secondExtendedSend
            case 0x86: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&63), b2>>6, false); return;
            case 0x87: this.pop(); return;  // pop
            case 0x88: this.push(this.top()); return;   // dup
            // thisContext
            case 0x89: this.push(this.exportThisContext()); return;

            // Closures
            case 0x8A: this.pushNewArray(this.nextByte());   // create new temp vector
                return;
            case 0x8B: this.callPrimBytecode(0x81);
                return;
            case 0x8C: b2 = this.nextByte(); // remote push from temp vector
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2]);
                return;
            case 0x8D: b2 = this.nextByte(); // remote store into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.top();
                return;
            case 0x8E: b2 = this.nextByte(); // remote store and pop into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.pop();
                return;
            case 0x8F: this.pushClosureCopy(); return;

            // Short jmp
            case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97:
                this.pc += (b&7)+1; return;
            // Short conditional jump on false
            case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F:
                this.jumpIfFalse((b&7)+1); return;
            // Long jump, forward and back
            case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xA7:
                b2 = this.nextByte();
                this.pc += (((b&7)-4)*256 + b2);
                if ((b&7)<4)        // check for process switch on backward jumps (loops)
                    if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
                return;
            // Long conditional jump on true
            case 0xA8: case 0xA9: case 0xAA: case 0xAB:
                this.jumpIfTrue((b&3)*256 + this.nextByte()); return;
            // Long conditional jump on false
            case 0xAC: case 0xAD: case 0xAE: case 0xAF:
                this.jumpIfFalse((b&3)*256 + this.nextByte()); return;

            // Arithmetic Ops... + - < > <= >= = ~=    * /  @ lshift: lxor: land: lor:
            case 0xB0: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) + this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // PLUS +
            case 0xB1: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) - this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // MINUS -
            case 0xB2: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) < this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LESS <
            case 0xB3: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) > this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GRTR >
            case 0xB4: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) <= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LEQ <=
            case 0xB5: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) >= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GEQ >=
            case 0xB6: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) === this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // EQU =
            case 0xB7: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) !== this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // NEQ ~=
            case 0xB8: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) * this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // TIMES *
            case 0xB9: this.success = true;
                if(!this.pop2AndPushIntResult(this.quickDivide(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide /
            case 0xBA: this.success = true;
                if(!this.pop2AndPushIntResult(this.mod(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // MOD \
            case 0xBB: this.success = true;
                if(!this.primHandler.primitiveMakePoint(1, true)) this.sendSpecial(b&0xF); return;  // MakePt int@int
            case 0xBC: this.success = true;
                if(!this.pop2AndPushIntResult(this.safeShift(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return; // bitShift:
            case 0xBD: this.success = true;
                if(!this.pop2AndPushIntResult(this.div(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide //
            case 0xBE: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) & this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitAnd:
            case 0xBF: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) | this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitOr:

            // at:, at:put:, size, next, nextPut:, ...
            case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5: case 0xC6: case 0xC7:
            case 0xC8: case 0xC9: case 0xCA: case 0xCB: case 0xCC: case 0xCD: case 0xCE: case 0xCF:
                if (!this.primHandler.quickSendOther(this.receiver, b&0xF))
                    this.sendSpecial((b&0xF)+16); return;

            // Send Literal Selector with 0, 1, and 2 args
            case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7:
            case 0xD8: case 0xD9: case 0xDA: case 0xDB: case 0xDC: case 0xDD: case 0xDE: case 0xDF:
                this.send(this.method.methodGetSelector(b&0xF), 0, false); return;
            case 0xE0: case 0xE1: case 0xE2: case 0xE3: case 0xE4: case 0xE5: case 0xE6: case 0xE7:
            case 0xE8: case 0xE9: case 0xEA: case 0xEB: case 0xEC: case 0xED: case 0xEE: case 0xEF:
                this.send(this.method.methodGetSelector(b&0xF), 1, false); return;
            case 0xF0: case 0xF1: case 0xF2: case 0xF3: case 0xF4: case 0xF5: case 0xF6: case 0xF7:
            case 0xF8: case 0xF9: case 0xFA: case 0xFB: case 0xFC: case 0xFD: case 0xFE: case 0xFF:
                this.send(this.method.methodGetSelector(b&0xF), 2, false); return;
        }
        throw Error("not a bytecode: " + b);
    },
    interpretOneSistaWithExtensions: function(singleStep, extA, extB) {
        var Squeak = this.Squeak; // avoid dynamic lookup of "Squeak" in Lively
        var b, b2;
        this.byteCodeCount++;
        b = this.nextByte();
        switch (b) { /* The Main Sista Bytecode Dispatch Loop */

            // 1 Byte Bytecodes

            // load receiver variable
            case 0x00: case 0x01: case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07:
            case 0x08: case 0x09: case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x0E: case 0x0F:
                this.push(this.receiver.pointers[b&0xF]); return;

            // load literal variable
            case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17:
            case 0x18: case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: case 0x1F:
                this.push((this.method.methodGetLiteral(b&0xF)).pointers[Squeak.Assn_value]); return;

            // load literal constant
            case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25: case 0x26: case 0x27:
            case 0x28: case 0x29: case 0x2A: case 0x2B: case 0x2C: case 0x2D: case 0x2E: case 0x2F:
            case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35: case 0x36: case 0x37:
            case 0x38: case 0x39: case 0x3A: case 0x3B: case 0x3C: case 0x3D: case 0x3E: case 0x3F:
                this.push(this.method.methodGetLiteral(b&0x1F)); return;

            // load temporary variable
            case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x47:
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&0x7)]); return;
            case 0x48: case 0x49: case 0x4A: case 0x4B:
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&0x3)+8]); return;

            case 0x4C: this.push(this.receiver); return;
            case 0x4D: this.push(this.trueObj); return;
            case 0x4E: this.push(this.falseObj); return;
            case 0x4F: this.push(this.nilObj); return;
            case 0x50: this.push(0); return;
            case 0x51: this.push(1); return;
            case 0x52:
                if (extB == 0) {
                    this.push(this.exportThisContext()); return;
                } else {
                    this.nono(); return;
                }
            case 0x53: this.push(this.top()); return;
            case 0x54: case 0x55: case 0x56: case 0x57: this.nono(); return; // unused
            case 0x58: this.doReturn(this.receiver); return;
            case 0x59: this.doReturn(this.trueObj); return;
            case 0x5A: this.doReturn(this.falseObj); return;
            case 0x5B: this.doReturn(this.nilObj); return;
            case 0x5C: this.doReturn(this.pop()); return;
            case 0x5D: this.doReturn(this.nilObj, this.activeContext.pointers[Squeak.BlockContext_caller]); return; // blockReturn nil
            case 0x5E:
                if (extA == 0) {
                    this.doReturn(this.pop(), this.activeContext.pointers[Squeak.BlockContext_caller]); return; // blockReturn
                } else {
                    this.nono(); return;
                }
            case 0x5F:
                return; // nop

             // Arithmetic Ops... + - < > <= >= = ~=    * /  @ lshift: lxor: land: lor:
             case 0x60: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) + this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // PLUS +
            case 0x61: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) - this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // MINUS -
            case 0x62: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) < this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LESS <
            case 0x63: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) > this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GRTR >
            case 0x64: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) <= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LEQ <=
            case 0x65: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) >= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GEQ >=
            case 0x66: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) === this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // EQU =
            case 0x67: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) !== this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // NEQ ~=
            case 0x68: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) * this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // TIMES *
            case 0x69: this.success = true;
                if(!this.pop2AndPushIntResult(this.quickDivide(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide /
            case 0x6A: this.success = true;
                if(!this.pop2AndPushIntResult(this.mod(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // MOD \
            case 0x6B: this.success = true;
                if(!this.primHandler.primitiveMakePoint(1, true)) this.sendSpecial(b&0xF); return;  // MakePt int@int
            case 0x6C: this.success = true;
                if(!this.pop2AndPushIntResult(this.safeShift(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return; // bitShift:
            case 0x6D: this.success = true;
                if(!this.pop2AndPushIntResult(this.div(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide //
            case 0x6E: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) & this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitAnd:
            case 0x6F: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) | this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitOr:

            // at:, at:put:, size, next, nextPut:, ...
            case 0x70: case 0x71: case 0x72: case 0x73: case 0x74: case 0x75: case 0x76: case 0x77:
            case 0x78: case 0x79: case 0x7A: case 0x7B: case 0x7C: case 0x7D: case 0x7E: case 0x7F:
                if (!this.primHandler.quickSendOther(this.receiver, b&0xF))
                    this.sendSpecial((b&0xF)+16); return;

            // Send Literal Selector with 0, 1, and 2 args
            case 0x80: case 0x81: case 0x82: case 0x83: case 0x84: case 0x85: case 0x86: case 0x87:
            case 0x88: case 0x89: case 0x8A: case 0x8B: case 0x8C: case 0x8D: case 0x8E: case 0x8F:
                this.send(this.method.methodGetSelector(b&0xF), 0, false); return;
            case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97:
            case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F:
                this.send(this.method.methodGetSelector(b&0xF), 1, false); return;
            case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xA7:
            case 0xA8: case 0xA9: case 0xAA: case 0xAB: case 0xAC: case 0xAD: case 0xAE: case 0xAF:
                this.send(this.method.methodGetSelector(b&0xF), 2, false); return;

            // Short jmp
            case 0xB0: case 0xB1: case 0xB2: case 0xB3: case 0xB4: case 0xB5: case 0xB6: case 0xB7:
                this.pc += (b&7)+1; return;
            // Short conditional jump on true
            case 0xB8: case 0xB9: case 0xBA: case 0xBB: case 0xBC: case 0xBD: case 0xBE: case 0xBF:
                this.jumpIfTrue((b&7)+1); return;
            // Short conditional jump on false
            case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5: case 0xC6: case 0xC7:
                this.jumpIfFalse((b&7)+1); return;

            // storeAndPop rcvr, temp
            case 0xC8: case 0xC9: case 0xCA: case 0xCB: case 0xCC: case 0xCD: case 0xCE: case 0xCF:
                this.receiver.dirty = true;
                this.receiver.pointers[b&7] = this.pop(); return;
            case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7:
                this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&7)] = this.pop(); return;

            case 0xD8: this.pop(); return;  // pop
            case 0xD9: this.nono(); return; // FIXME: Unconditional trap
            case 0xDA: case 0xDB: case 0xDC: case 0xDD: case 0xDE: case 0xDF:
                this.nono(); return; // unused

            // 2 Byte Bytecodes

            case 0xE0:
                b2 = this.nextByte(); this.interpretOneSistaWithExtensions(singleStep, (extA << 8) + b2, extB); return;
            case 0xE1:
                b2 = this.nextByte(); this.interpretOneSistaWithExtensions(singleStep, extA, (extB << 8) + (b2 < 128 ? b2 : b2-256)); return;
            case 0xE2:
                b2 = this.nextByte(); this.push(this.receiver.pointers[b2 + (extA << 8)]); return;
            case 0xE3:
                b2 = this.nextByte(); this.push((this.method.methodGetLiteral(b2 + (extA << 8))).pointers[Squeak.Assn_value]); return;
            case 0xE4:
                b2 = this.nextByte(); this.push(this.method.methodGetLiteral(b2 + (extA << 8))); return;
            case 0xE5:
                b2 = this.nextByte(); this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+b2]); return;
            case 0xE6: this.nono(); return; // unused
            case 0xE7: this.pushNewArray(this.nextByte()); return; // create new temp vector
            case 0xE8: b2 = this.nextByte(); this.push(b2 + (extB << 8)); return; // push SmallInteger
            case 0xE9: b2 = this.nextByte(); this.push(this.image.getCharacter(b2 + (extB << 8))); return; // push Character
            case 0xEA:
                b2 = this.nextByte();
                this.send(this.method.methodGetSelector((b2 >> 3) + (extA << 5)), (b2 & 7) + (extB << 3), false); return;
            case 0xEB:
                b2 = this.nextByte();
                var literal = this.method.methodGetSelector((b2 >> 3) + (extA << 5));
                if (extB >= 64) {
                    this.sendSuperDirected(literal, (b2 & 7) + ((extB & 63) << 3)); return;
                } else {
                    this.send(literal, (b2 & 7) + (extB << 3), true); return;
                }
            case 0xEC: this.nono(); return; // unused
            case 0xED: // long jump, forward and back
                var offset = this.nextByte() + (extB << 8);
                this.pc += offset;
                if (offset < 0)        // check for process switch on backward jumps (loops)
                    if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
                return;
            case 0xEE: // long conditional jump on true
                this.jumpIfTrue(this.nextByte() + (extB << 8)); return;
            case 0xEF: // long conditional jump on false
                this.jumpIfFalse(this.nextByte() + (extB << 8)); return;
            case 0xF0: // pop into receiver
                this.receiver.dirty = true;
                this.receiver.pointers[this.nextByte() + (extA << 8)] = this.pop();
                return;
            case 0xF1: // pop into literal
                var assoc = this.method.methodGetLiteral(this.nextByte() + (extA << 8));
                assoc.dirty = true;
                assoc.pointers[Squeak.Assn_value] = this.pop();
                return;
            case 0xF2: // pop into temp
                this.homeContext.pointers[Squeak.Context_tempFrameStart + this.nextByte()] = this.pop();
                return;
            case 0xF3: // store into receiver
                this.receiver.dirty = true;
                this.receiver.pointers[this.nextByte() + (extA << 8)] = this.top();
                return;
            case 0xF4: // store into literal
                var assoc = this.method.methodGetLiteral(this.nextByte() + (extA << 8));
                assoc.dirty = true;
                assoc.pointers[Squeak.Assn_value] = this.top();
                return;
            case 0xF5: // store into temp
                this.homeContext.pointers[Squeak.Context_tempFrameStart + this.nextByte()] = this.top();
                return;
            case 0xF6: case 0xF7: this.nono(); return; // unused

            // 3 Byte Bytecodes

            case 0xF8: this.callPrimBytecode(0xF5); return;
            case 0xF9: this.pushFullClosure(extA); return;
            case 0xFA: this.pushClosureCopyExtended(extA, extB); return;
            case 0xFB: b2 = this.nextByte(); // remote push from temp vector
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2]);
                return;
            case 0xFC: b2 = this.nextByte(); // remote store into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.top();
                return;
            case 0xFD: b2 = this.nextByte(); // remote store and pop into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.pop();
                return;
            case 0xFE: case 0xFF: this.nono(); return; // unused
        }
        throw Error("not a bytecode: " + b);
    },
    interpret: function(forMilliseconds, thenDo) {
        // run for a couple milliseconds (but only until idle or break)
        // answer milliseconds to sleep (until next timer wakeup)
        // or 'break' if reached breakpoint
        // call thenDo with that result when done
        if (this.frozen) return 'frozen';
        this.isIdle = false;
        this.breakOutOfInterpreter = false;
        this.breakOutTick = this.primHandler.millisecondClockValue() + (forMilliseconds || 500);
        while (this.breakOutOfInterpreter === false)
            if (this.method.compiled) {
                this.method.compiled(this);
            } else {
                this.interpretOne();
            }
        // this is to allow 'freezing' the interpreter and restarting it asynchronously. See freeze()
        if (typeof this.breakOutOfInterpreter == "function")
            return this.breakOutOfInterpreter(thenDo);
        // normally, we answer regularly
        var result = this.breakOutOfInterpreter == 'break' ? 'break'
            : !this.isIdle ? 0
            : !this.nextWakeupTick ? 'sleep'        // all processes waiting
            : Math.max(1, this.nextWakeupTick - this.primHandler.millisecondClockValue());
        if (thenDo) thenDo(result);
        return result;
    },
    goIdle: function() {
        // make sure we tend to pending delays
        var hadTimer = this.nextWakeupTick !== 0;
        this.forceInterruptCheck();
        this.checkForInterrupts();
        var hasTimer = this.nextWakeupTick !== 0;
        // go idle unless a timer just expired
        this.isIdle = hasTimer || !hadTimer;
        this.breakOut();
    },
    freeze: function(frozenDo) {
        // Stop the interpreter. Answer a function that can be
        // called to continue interpreting.
        // Optionally, frozenDo is called asynchronously when frozen
        var continueFunc;
        this.frozen = true;
        this.breakOutOfInterpreter = function(thenDo) {
            if (!thenDo) throw Error("need function to restart interpreter");
            continueFunc = thenDo;
            return "frozen";
        }.bind(this);
        var unfreeze = function() {
            this.frozen = false;
            if (!continueFunc) throw Error("no continue function");
            continueFunc(0);    //continue without timeout
        }.bind(this);
        if (frozenDo) self.setTimeout(function(){frozenDo(unfreeze)}, 0);
        return unfreeze;
    },
    breakOut: function() {
        this.breakOutOfInterpreter = this.breakOutOfInterpreter || true; // do not overwrite break string
    },
    nextByte: function() {
        return this.method.bytes[this.pc++];
    },
    nono: function() {
        throw Error("Oh No!");
    },
    forceInterruptCheck: function() {
        this.interruptCheckCounter = -1000;
    },
    checkForInterrupts: function() {
        //Check for interrupts at sends and backward jumps
        var now = this.primHandler.millisecondClockValue();
        if (now < this.lastTick) { // millisecond clock wrapped
            this.nextPollTick = now + (this.nextPollTick - this.lastTick);
            this.breakOutTick = now + (this.breakOutTick - this.lastTick);
            if (this.nextWakeupTick !== 0)
                this.nextWakeupTick = now + (this.nextWakeupTick - this.lastTick);
        }
        //Feedback logic attempts to keep interrupt response around 3ms...
        if (this.interruptCheckCounter > -100) { // only if not a forced check
            if ((now - this.lastTick) < this.interruptChecksEveryNms) { //wrapping is not a concern
                this.interruptCheckCounterFeedBackReset += 10;
            } else { // do a thousand sends even if we are too slow for 3ms
                if (this.interruptCheckCounterFeedBackReset <= 1000)
                    this.interruptCheckCounterFeedBackReset = 1000;
                else
                    this.interruptCheckCounterFeedBackReset -= 12;
            }
        }
        this.interruptCheckCounter = this.interruptCheckCounterFeedBackReset; //reset the interrupt check counter
        this.lastTick = now; //used to detect wraparound of millisecond clock
        //  if(signalLowSpace) {
        //            signalLowSpace= false; //reset flag
        //            sema= getSpecialObject(Squeak.splOb_TheLowSpaceSemaphore);
        //            if(sema != nilObj) synchronousSignal(sema); }
        //  if(now >= nextPollTick) {
        //            ioProcessEvents(); //sets interruptPending if interrupt key pressed
        //            nextPollTick= now + 500; } //msecs to wait before next call to ioProcessEvents"
        if (this.interruptPending) {
            this.interruptPending = false; //reset interrupt flag
            var sema = this.specialObjects[Squeak.splOb_TheInterruptSemaphore];
            if (!sema.isNil) this.primHandler.synchronousSignal(sema);
        }
        if ((this.nextWakeupTick !== 0) && (now >= this.nextWakeupTick)) {
            this.nextWakeupTick = 0; //reset timer interrupt
            var sema = this.specialObjects[Squeak.splOb_TheTimerSemaphore];
            if (!sema.isNil) this.primHandler.synchronousSignal(sema);
        }
        if (this.pendingFinalizationSignals > 0) { //signal any pending finalizations
            var sema = this.specialObjects[Squeak.splOb_TheFinalizationSemaphore];
            this.pendingFinalizationSignals = 0;
            if (!sema.isNil) this.primHandler.synchronousSignal(sema);
        }
        if (this.primHandler.semaphoresToSignal.length > 0)
            this.primHandler.signalExternalSemaphores();  // signal pending semaphores, if any
        // if this is a long-running do-it, compile it
        if (!this.method.compiled && this.compiler)
            this.compiler.compile(this.method);
        // have to return to web browser once in a while
        if (now >= this.breakOutTick)
            this.breakOut();
    },
    extendedPush: function(nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.push(this.receiver.pointers[lobits]);break;
            case 1: this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits]); break;
            case 2: this.push(this.method.methodGetLiteral(lobits)); break;
            case 3: this.push(this.method.methodGetLiteral(lobits).pointers[Squeak.Assn_value]); break;
        }
    },
    extendedStore: function( nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0:
                this.receiver.dirty = true;
                this.receiver.pointers[lobits] = this.top();
                break;
            case 1:
                this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits] = this.top();
                break;
            case 2:
                this.nono();
                break;
            case 3:
                var assoc = this.method.methodGetLiteral(lobits);
                assoc.dirty = true;
                assoc.pointers[Squeak.Assn_value] = this.top();
                break;
        }
    },
    extendedStorePop: function(nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0:
                this.receiver.dirty = true;
                this.receiver.pointers[lobits] = this.pop();
                break;
            case 1:
                this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits] = this.pop();
                break;
            case 2:
                this.nono();
                break;
            case 3:
                var assoc = this.method.methodGetLiteral(lobits);
                assoc.dirty = true;
                assoc.pointers[Squeak.Assn_value] = this.pop();
                break;
        }
    },
    doubleExtendedDoAnything: function(byte2) {
        var byte3 = this.nextByte();
        switch (byte2>>5) {
            case 0: this.send(this.method.methodGetSelector(byte3), byte2&31, false); break;
            case 1: this.send(this.method.methodGetSelector(byte3), byte2&31, true); break;
            case 2: this.push(this.receiver.pointers[byte3]); break;
            case 3: this.push(this.method.methodGetLiteral(byte3)); break;
            case 4: this.push(this.method.methodGetLiteral(byte3).pointers[Squeak.Assn_value]); break;
            case 5: this.receiver.dirty = true; this.receiver.pointers[byte3] = this.top(); break;
            case 6: this.receiver.dirty = true; this.receiver.pointers[byte3] = this.pop(); break;
            case 7: var assoc = this.method.methodGetLiteral(byte3);
                assoc.dirty = true;
                assoc.pointers[Squeak.Assn_value] = this.top(); break;
        }
    },
    jumpIfTrue: function(delta) {
        var top = this.pop();
        if (top.isTrue) {this.pc += delta; return;}
        if (top.isFalse) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Squeak.splOb_SelectorMustBeBoolean], 0, false);
    },
    jumpIfFalse: function(delta) {
        var top = this.pop();
        if (top.isFalse) {this.pc += delta; return;}
        if (top.isTrue) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Squeak.splOb_SelectorMustBeBoolean], 0, false);
    },
    sendSpecial: function(lobits) {
        this.send(this.specialSelectors[lobits*2],
            this.specialSelectors[(lobits*2)+1],
            false);  //specialSelectors is  {...sel,nArgs,sel,nArgs,...)
    },
    callPrimBytecode: function(extendedStoreBytecode) {
        this.pc += 2; // skip over primitive number
        if (this.primFailCode) {
            if (this.method.bytes[this.pc] === extendedStoreBytecode)
                this.stackTopPut(this.getErrorObjectFromPrimFailCode());
            this.primFailCode = 0;
        }
    },
    getErrorObjectFromPrimFailCode: function() {
        var primErrTable = this.specialObjects[Squeak.splOb_PrimErrTableIndex];
        if (primErrTable && primErrTable.pointers) {
            var errorObject = primErrTable.pointers[this.primFailCode - 1];
            if (errorObject) return errorObject;
        }
        return this.primFailCode;
    },
},
'closures', {
    pushNewArray: function(nextByte) {
        var popValues = nextByte > 127,
            count = nextByte & 127,
            array = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], count);
        if (popValues) {
            for (var i = 0; i < count; i++)
                array.pointers[i] = this.stackValue(count - i - 1);
            this.popN(count);
        }
        this.push(array);
    },
    pushClosureCopy: function() {
        // The compiler has pushed the values to be copied, if any.  Find numArgs and numCopied in the byte following.
        // Create a Closure with space for the copiedValues and pop numCopied values off the stack into the closure.
        // Set numArgs as specified, and set startpc to the pc following the block size and jump over that code.
        var numArgsNumCopied = this.nextByte(),
            numArgs = numArgsNumCopied & 0xF,
            numCopied = numArgsNumCopied >> 4,
            blockSizeHigh = this.nextByte(),
            blockSize = blockSizeHigh * 256 + this.nextByte(),
            initialPC = this.encodeSqueakPC(this.pc, this.method),
            closure = this.newClosure(numArgs, initialPC, numCopied);
        closure.pointers[Squeak.Closure_outerContext] = this.activeContext;
        this.reclaimableContextCount = 0; // The closure refers to thisContext so it can't be reclaimed
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                closure.pointers[Squeak.Closure_firstCopiedValue + i] = this.stackValue(numCopied - i - 1);
            this.popN(numCopied);
        }
        this.pc += blockSize;
        this.push(closure);
    },
    pushClosureCopyExtended: function(extA, extB) {
        var byteA = this.nextByte();
        var byteB = this.nextByte();
        var numArgs = (byteA & 7) + this.mod(extA, 16) * 8,
            numCopied = (byteA >> 3 & 0x7) + this.div(extA, 16) * 8,
            blockSize = byteB + (extB << 8),
            initialPC = this.encodeSqueakPC(this.pc, this.method),
            closure = this.newClosure(numArgs, initialPC, numCopied);
        closure.pointers[Squeak.Closure_outerContext] = this.activeContext;
        this.reclaimableContextCount = 0; // The closure refers to thisContext so it can't be reclaimed
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                closure.pointers[Squeak.Closure_firstCopiedValue + i] = this.stackValue(numCopied - i - 1);
            this.popN(numCopied);
        }
        this.pc += blockSize;
        this.push(closure);
    },
    pushFullClosure: function(extA) {
        var byteA = this.nextByte();
        var byteB = this.nextByte();
        var literalIndex = byteA + (extA << 8);
        var numCopied = byteB & 63;
        var context;
        if ((byteB >> 6 & 1) == 1) {
            context = this.vm.nilObj;
        } else {
            context = this.activeContext;
        }
        var compiledBlock = this.method.methodGetLiteral(literalIndex);
        var closure = this.newFullClosure(context, numCopied, compiledBlock);
        if ((byteB >> 7 & 1) == 1) {
            throw Error("on-stack receiver not yet supported");
        } else {
            closure.pointers[Squeak.ClosureFull_receiver] = this.receiver;
        }
        this.reclaimableContextCount = 0; // The closure refers to thisContext so it can't be reclaimed
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                closure.pointers[Squeak.ClosureFull_firstCopiedValue + i] = this.stackValue(numCopied - i - 1);
            this.popN(numCopied);
        }
        this.push(closure);
    },
    newClosure: function(numArgs, initialPC, numCopied) {
        var closure = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassBlockClosure], numCopied);
        closure.pointers[Squeak.Closure_startpc] = initialPC;
        closure.pointers[Squeak.Closure_numArgs] = numArgs;
        return closure;
    },
    newFullClosure: function(context, numCopied, compiledBlock) {
        var closure = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassFullBlockClosure], numCopied);
        closure.pointers[Squeak.Closure_outerContext] = context;
        closure.pointers[Squeak.ClosureFull_method] = compiledBlock;
        closure.pointers[Squeak.Closure_numArgs] = compiledBlock.methodNumArgs();
        return closure;
    },
},
'sending', {
    send: function(selector, argCount, doSuper) {
        var newRcvr = this.stackValue(argCount);
        var lookupClass;
        if (doSuper) {
            lookupClass = this.method.methodClassForSuper();
            lookupClass = lookupClass.pointers[Squeak.Class_superclass];
        } else {
            lookupClass = this.getClass(newRcvr);
        }
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        if (entry.primIndex) {
            //note details for verification of at/atput primitives
            this.verifyAtSelector = selector;
            this.verifyAtClass = lookupClass;
        }
        this.executeNewMethod(newRcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
    },
    sendSuperDirected: function(selector, argCount) {
        var lookupClass = this.pop().pointers[Squeak.Class_superclass];
        var newRcvr = this.stackValue(argCount);
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        if (entry.primIndex) {
            //note details for verification of at/atput primitives
            this.verifyAtSelector = selector;
            this.verifyAtClass = lookupClass;
        }
        this.executeNewMethod(newRcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
    },
    sendAsPrimitiveFailure: function(rcvr, method, argCount) {
        this.executeNewMethod(rcvr, method, argCount, 0);
    },
    findSelectorInClass: function(selector, argCount, startingClass) {
        this.currentSelector = selector; // for primitiveInvokeObjectAsMethod
        var cacheEntry = this.findMethodCacheEntry(selector, startingClass);
        if (cacheEntry.method) return cacheEntry; // Found it in the method cache
        var currentClass = startingClass;
        var mDict;
        while (!currentClass.isNil) {
            mDict = currentClass.pointers[Squeak.Class_mdict];
            if (mDict.isNil) {
                // MethodDict pointer is nil (hopefully due a swapped out stub)
                //        -- send #cannotInterpret:
                var cantInterpSel = this.specialObjects[Squeak.splOb_SelectorCannotInterpret],
                    cantInterpMsg = this.createActualMessage(selector, argCount, startingClass);
                this.popNandPush(argCount, cantInterpMsg);
                return this.findSelectorInClass(cantInterpSel, 1, currentClass.superclass());
            }
            var newMethod = this.lookupSelectorInDict(mDict, selector);
            if (!newMethod.isNil) {
                // if method is not actually a CompiledMethod, let primitiveInvokeObjectAsMethod (576) handle it
                cacheEntry.method = newMethod;
                cacheEntry.primIndex = newMethod.isMethod() ? newMethod.methodPrimitiveIndex() : 576;
                cacheEntry.argCount = argCount;
                cacheEntry.mClass = currentClass;
                return cacheEntry;
            }
            currentClass = currentClass.superclass();
        }
        //Cound not find a normal message -- send #doesNotUnderstand:
        var dnuSel = this.specialObjects[Squeak.splOb_SelectorDoesNotUnderstand];
        if (selector === dnuSel) // Cannot find #doesNotUnderstand: -- unrecoverable error.
            throw Error("Recursive not understood error encountered");
        var dnuMsg = this.createActualMessage(selector, argCount, startingClass); //The argument to doesNotUnderstand:
        this.popNandPush(argCount, dnuMsg);
        return this.findSelectorInClass(dnuSel, 1, startingClass);
    },
    lookupSelectorInDict: function(mDict, messageSelector) {
        //Returns a method or nilObject
        var dictSize = mDict.pointersSize();
        var mask = (dictSize - Squeak.MethodDict_selectorStart) - 1;
        var index = (mask & messageSelector.hash) + Squeak.MethodDict_selectorStart;
        // If there are no nils (should always be), then stop looping on second wrap.
        var hasWrapped = false;
        while (true) {
            var nextSelector = mDict.pointers[index];
            if (nextSelector === messageSelector) {
                var methArray = mDict.pointers[Squeak.MethodDict_array];
                return methArray.pointers[index - Squeak.MethodDict_selectorStart];
            }
            if (nextSelector.isNil) return this.nilObj;
            if (++index === dictSize) {
                if (hasWrapped) return this.nilObj;
                index = Squeak.MethodDict_selectorStart;
                hasWrapped = true;
            }
        }
    },
    executeNewMethod: function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
        this.sendCount++;
        if (newMethod === this.breakOnMethod) this.breakNow("executing method " + this.printMethod(newMethod, optClass, optSel));
        if (this.logSends) console.log(this.sendCount + ' ' + this.printMethod(newMethod, optClass, optSel));
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
        if (primitiveIndex > 0)
            if (this.tryPrimitive(primitiveIndex, argumentCount, newMethod))
                return;  //Primitive succeeded -- end of story
        var newContext = this.allocateOrRecycleContext(newMethod.methodNeedsLargeFrame());
        var tempCount = newMethod.methodTempCount();
        var newPC = 0; // direct zero-based index into byte codes
        var newSP = Squeak.Context_tempFrameStart + tempCount - 1; // direct zero-based index into context pointers
        newContext.pointers[Squeak.Context_method] = newMethod;
        //Following store is in case we alloc without init; all other fields get stored
        newContext.pointers[Squeak.BlockContext_initialIP] = this.nilObj;
        newContext.pointers[Squeak.Context_sender] = this.activeContext;
        //Copy receiver and args to new context
        //Note this statement relies on the receiver slot being contiguous with args...
        this.arrayCopy(this.activeContext.pointers, this.sp-argumentCount, newContext.pointers, Squeak.Context_tempFrameStart-1, argumentCount+1);
        //...and fill the remaining temps with nil
        this.arrayFill(newContext.pointers, Squeak.Context_tempFrameStart+argumentCount, Squeak.Context_tempFrameStart+tempCount, this.nilObj);
        this.popN(argumentCount+1);
        this.reclaimableContextCount++;
        this.storeContextRegisters();
        /////// Woosh //////
        this.activeContext = newContext; //We're off and running...
        //Following are more efficient than fetchContextRegisters() in newActiveContext()
        this.activeContext.dirty = true;
        this.homeContext = newContext;
        this.method = newMethod;
        this.pc = newPC;
        this.sp = newSP;
        this.receiver = newContext.pointers[Squeak.Context_receiver];
        if (this.receiver !== newRcvr)
            throw Error("receivers don't match");
        if (!newMethod.compiled && this.compiler)
            this.compiler.compile(newMethod, optClass, optSel);
        // check for process switch on full method activation
        if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
    },
    doReturn: function(returnValue, targetContext) {
        // get sender from block home or closure's outerContext
        if (!targetContext) {
            var ctx = this.homeContext;
            if (this.hasClosures) {
                var closure;
                while (!(closure = ctx.pointers[Squeak.Context_closure]).isNil)
                    ctx = closure.pointers[Squeak.Closure_outerContext];
            }
            targetContext = ctx.pointers[Squeak.Context_sender];
        }
        if (targetContext.isNil || targetContext.pointers[Squeak.Context_instructionPointer].isNil)
            return this.cannotReturn(returnValue);
        // search up stack for unwind
        var thisContext = this.activeContext.pointers[Squeak.Context_sender];
        while (thisContext !== targetContext) {
            if (thisContext.isNil)
                return this.cannotReturn(returnValue);
            if (this.isUnwindMarked(thisContext))
                return this.aboutToReturnThrough(returnValue, thisContext);
            thisContext = thisContext.pointers[Squeak.Context_sender];
        }
        // no unwind to worry about, just peel back the stack (usually just to sender)
        var nextContext;
        thisContext = this.activeContext;
        while (thisContext !== targetContext) {
            if (this.breakOnContextReturned === thisContext) {
                this.breakOnContextReturned = null;
                this.breakNow();
            }
            nextContext = thisContext.pointers[Squeak.Context_sender];
            thisContext.pointers[Squeak.Context_sender] = this.nilObj;
            thisContext.pointers[Squeak.Context_instructionPointer] = this.nilObj;
            if (this.reclaimableContextCount > 0) {
                this.reclaimableContextCount--;
                this.recycleIfPossible(thisContext);
            }
            thisContext = nextContext;
        }
        this.activeContext = thisContext;
        this.activeContext.dirty = true;
        this.fetchContextRegisters(this.activeContext);
        this.push(returnValue);
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
    },
    aboutToReturnThrough: function(resultObj, aContext) {
        this.push(this.exportThisContext());
        this.push(resultObj);
        this.push(aContext);
        var aboutToReturnSel = this.specialObjects[Squeak.splOb_SelectorAboutToReturn];
        this.send(aboutToReturnSel, 2);
    },
    cannotReturn: function(resultObj) {
        this.push(this.exportThisContext());
        this.push(resultObj);
        var cannotReturnSel = this.specialObjects[Squeak.splOb_SelectorCannotReturn];
        this.send(cannotReturnSel, 1);
    },
    tryPrimitive: function(primIndex, argCount, newMethod) {
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
        var context = this.activeContext;
        var success = this.primHandler.doPrimitive(primIndex, argCount, newMethod);
        if (success
            && this.sp !== sp - argCount
            && context === this.activeContext
            && primIndex !== 117    // named prims are checked separately
            && !this.frozen) {
                this.warnOnce("stack unbalanced after primitive " + primIndex, "error");
            }
        return success;
    },
    createActualMessage: function(selector, argCount, cls) {
        //Bundle up receiver, args and selector as a messageObject
        var message = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMessage], 0);
        var argArray = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], argCount);
        this.arrayCopy(this.activeContext.pointers, this.sp-argCount+1, argArray.pointers, 0, argCount); //copy args from stack
        message.pointers[Squeak.Message_selector] = selector;
        message.pointers[Squeak.Message_arguments] = argArray;
        if (message.pointers.length > Squeak.Message_lookupClass) //Early versions don't have lookupClass
            message.pointers[Squeak.Message_lookupClass] = cls;
        return message;
    },
    primitivePerform: function(argCount) {
        var selector = this.stackValue(argCount-1);
        var rcvr = this.stackValue(argCount);
        // NOTE: findNewMethodInClass may fail and be converted to #doesNotUnderstand:,
        //       (Whoah) so we must slide args down on the stack now, so that would work
        var trueArgCount = argCount - 1;
        var selectorIndex = this.sp - trueArgCount;
        var stack = this.activeContext.pointers; // slide eveything down...
        this.arrayCopy(stack, selectorIndex+1, stack, selectorIndex, trueArgCount);
        this.sp--; // adjust sp accordingly
        var entry = this.findSelectorInClass(selector, trueArgCount, this.getClass(rcvr));
        this.executeNewMethod(rcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
        return true;
    },
    primitivePerformWithArgs: function(argCount, supered) {
        var rcvrPos = supered ? 3 : 2;
        var rcvr = this.stackValue(rcvrPos);
        var selector = this.stackValue(rcvrPos - 1);
        var args = this.stackValue(rcvrPos - 2);
        if (args.sqClass !== this.specialObjects[Squeak.splOb_ClassArray])
            return false;
        var lookupClass = supered ? this.top() : this.getClass(rcvr);
        if (supered) { // verify that lookupClass is in fact in superclass chain of receiver;
            var cls = this.getClass(rcvr);
            while (cls !== lookupClass) {
                cls = cls.pointers[Squeak.Class_superclass];
                if (cls.isNil) return false;
            }
        }
        var trueArgCount = args.pointersSize();
        var selectorIndex = this.sp - (rcvrPos - 1);
        var stack = this.activeContext.pointers;
        this.arrayCopy(args.pointers, 0, stack, selectorIndex, trueArgCount);
        this.sp += trueArgCount - argCount; //pop selector and array then push args
        var entry = this.findSelectorInClass(selector, trueArgCount, lookupClass);
        this.executeNewMethod(rcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
        return true;
    },
    primitiveInvokeObjectAsMethod: function(argCount, method) {
        // invoked from VM if non-method found in lookup
        var orgArgs = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], argCount);
        for (var i = 0; i < argCount; i++)
            orgArgs.pointers[argCount - i - 1] = this.pop();
        var orgReceiver = this.pop(),
            orgSelector = this.currentSelector;
        // send run:with:in: to non-method object
        var runWithIn = this.specialObjects[Squeak.splOb_SelectorRunWithIn];
        this.push(method);       // not actually a method
        this.push(orgSelector);
        this.push(orgArgs);
        this.push(orgReceiver);
        this.send(runWithIn, 3, false);
        return true;
    },
    findMethodCacheEntry: function(selector, lkupClass) {
        //Probe the cache, and return the matching entry if found
        //Otherwise return one that can be used (selector and class set) with method == null.
        //Initial probe is class xor selector, reprobe delta is selector
        //We do not try to optimize probe time -- all are equally 'fast' compared to lookup
        //Instead we randomize the reprobe so two or three very active conflicting entries
        //will not keep dislodging each other
        var entry;
        this.methodCacheRandomish = (this.methodCacheRandomish + 1) & 3;
        var firstProbe = (selector.hash ^ lkupClass.hash) & this.methodCacheMask;
        var probe = firstProbe;
        for (var i = 0; i < 4; i++) { // 4 reprobes for now
            entry = this.methodCache[probe];
            if (entry.selector === selector && entry.lkupClass === lkupClass) return entry;
            if (i === this.methodCacheRandomish) firstProbe = probe;
            probe = (probe + selector.hash) & this.methodCacheMask;
        }
        entry = this.methodCache[firstProbe];
        entry.lkupClass = lkupClass;
        entry.selector = selector;
        entry.method = null;
        return entry;
    },
    flushMethodCache: function() { //clear all cache entries (prim 89)
        for (var i = 0; i < this.methodCacheSize; i++) {
            this.methodCache[i].selector = null;   // mark it free
            this.methodCache[i].method = null;  // release the method
        }
        return true;
    },
    flushMethodCacheForSelector: function(selector) { //clear cache entries for selector (prim 119)
        for (var i = 0; i < this.methodCacheSize; i++)
            if (this.methodCache[i].selector === selector) {
                this.methodCache[i].selector = null;   // mark it free
                this.methodCache[i].method = null;  // release the method
            }
        return true;
    },
    flushMethodCacheForMethod: function(method) { //clear cache entries for method (prim 116)
        for (var i = 0; i < this.methodCacheSize; i++)
            if (this.methodCache[i].method === method) {
                this.methodCache[i].selector = null;   // mark it free
                this.methodCache[i].method = null;  // release the method
            }
        return true;
    },
    flushMethodCacheAfterBecome: function(mutations) {
        // could be selective by checking lkupClass, selector,
        // and method against mutations dict
        this.flushMethodCache();
    },
},
'contexts', {
    isUnwindMarked: function(ctx) {
        if (!this.isMethodContext(ctx)) return false;
        var method = ctx.pointers[Squeak.Context_method];
        return method.methodPrimitiveIndex() == 198;
    },
    newActiveContext: function(newContext) {
        // Note: this is inlined in executeNewMethod() and doReturn()
        this.storeContextRegisters();
        this.activeContext = newContext; //We're off and running...
        this.activeContext.dirty = true;
        this.fetchContextRegisters(newContext);
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
    },
    exportThisContext: function() {
        this.storeContextRegisters();
        this.reclaimableContextCount = 0;
        return this.activeContext;
    },
    fetchContextRegisters: function(ctxt) {
        var meth = ctxt.pointers[Squeak.Context_method];
        if (this.isSmallInt(meth)) { //if the Method field is an integer, activeCntx is a block context
            this.homeContext = ctxt.pointers[Squeak.BlockContext_home];
            meth = this.homeContext.pointers[Squeak.Context_method];
        } else { //otherwise home==ctxt
            this.homeContext = ctxt;
        }
        this.receiver = this.homeContext.pointers[Squeak.Context_receiver];
        this.method = meth;
        this.pc = this.decodeSqueakPC(ctxt.pointers[Squeak.Context_instructionPointer], meth);
        this.sp = this.decodeSqueakSP(ctxt.pointers[Squeak.Context_stackPointer]);
    },
    storeContextRegisters: function() {
        //Save pc, sp into activeContext object, prior to change of context
        //   see fetchContextRegisters for symmetry
        //   expects activeContext, pc, sp, and method state vars to still be valid
        this.activeContext.pointers[Squeak.Context_instructionPointer] = this.encodeSqueakPC(this.pc, this.method);
        this.activeContext.pointers[Squeak.Context_stackPointer] = this.encodeSqueakSP(this.sp);
    },
    encodeSqueakPC: function(intPC, method) {
        // Squeak pc is offset by header and literals
        // and 1 for z-rel addressing
        return intPC + method.pointers.length * 4 + 1;
    },
    decodeSqueakPC: function(squeakPC, method) {
        return squeakPC - method.pointers.length * 4 - 1;
    },
    encodeSqueakSP: function(intSP) {
        // sp is offset by tempFrameStart, -1 for z-rel addressing
        return intSP - (Squeak.Context_tempFrameStart - 1);
    },
    decodeSqueakSP: function(squeakSP) {
        return squeakSP + (Squeak.Context_tempFrameStart - 1);
    },
    recycleIfPossible: function(ctxt) {
        if (!this.isMethodContext(ctxt)) return;
        if (ctxt.pointersSize() === (Squeak.Context_tempFrameStart+Squeak.Context_smallFrameSize)) {
            // Recycle small contexts
            ctxt.pointers[0] = this.freeContexts;
            this.freeContexts = ctxt;
        } else { // Recycle large contexts
            if (ctxt.pointersSize() !== (Squeak.Context_tempFrameStart+Squeak.Context_largeFrameSize))
                return;
            ctxt.pointers[0] = this.freeLargeContexts;
            this.freeLargeContexts = ctxt;
        }
    },
    allocateOrRecycleContext: function(needsLarge) {
        //Return a recycled context or a newly allocated one if none is available for recycling."
        var freebie;
        if (needsLarge) {
            if (!this.freeLargeContexts.isNil) {
                freebie = this.freeLargeContexts;
                this.freeLargeContexts = freebie.pointers[0];
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMethodContext], Squeak.Context_largeFrameSize);
        } else {
            if (!this.freeContexts.isNil) {
                freebie = this.freeContexts;
                this.freeContexts = freebie.pointers[0];
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMethodContext], Squeak.Context_smallFrameSize);
        }
    },
},
'stack access', {
    pop: function() {
        //Note leaves garbage above SP.  Cleaned out by fullGC.
        return this.activeContext.pointers[this.sp--];
    },
    popN: function(nToPop) {
        this.sp -= nToPop;
    },
    push: function(object) {
        this.activeContext.pointers[++this.sp] = object;
    },
    popNandPush: function(nToPop, object) {
        this.activeContext.pointers[this.sp -= nToPop - 1] = object;
    },
    top: function() {
        return this.activeContext.pointers[this.sp];
    },
    stackTopPut: function(object) {
        this.activeContext.pointers[this.sp] = object;
    },
    stackValue: function(depthIntoStack) {
        return this.activeContext.pointers[this.sp - depthIntoStack];
    },
    stackInteger: function(depthIntoStack) {
        return this.checkSmallInt(this.stackValue(depthIntoStack));
    },
    stackIntOrFloat: function(depthIntoStack) {
        var num = this.stackValue(depthIntoStack);
        // is it a SmallInt?
        if (typeof num === "number") return num;
        if (num === undefined) {this.success = false; return 0;}
        // is it a Float?
        if (num.isFloat) {
            this.resultIsFloat = true;   // need to return result as Float
            return num.float;
        }
        // maybe a 32-bit LargeInt?
        var bytes = num.bytes;
        if (bytes && bytes.length == 4) {
            var value = 0;
            for (var i = 3; i >= 0; i--)
                value = value * 256 + bytes[i];
            if (num.sqClass === this.specialObjects[Squeak.splOb_ClassLargePositiveInteger])
                return value;
            if (num.sqClass === this.specialObjects[Squeak.splOb_ClassLargeNegativeInteger])
                return -value;
        }
        // none of the above
        this.success = false;
        return 0;
    },
    pop2AndPushIntResult: function(intResult) {// returns success boolean
        if (this.success && this.canBeSmallInt(intResult)) {
            this.popNandPush(2, intResult);
            return true;
        }
        return false;
    },
    pop2AndPushNumResult: function(numResult) {// returns success boolean
        if (this.success) {
            if (this.resultIsFloat) {
                this.popNandPush(2, this.primHandler.makeFloat(numResult));
                return true;
            }
            if (numResult >= Squeak.MinSmallInt && numResult <= Squeak.MaxSmallInt) {
                this.popNandPush(2, numResult);
                return true;
            }
            if (numResult >= -0xFFFFFFFF && numResult <= 0xFFFFFFFF) {
                var negative = numResult < 0,
                    unsigned = negative ? -numResult : numResult,
                    lgIntClass = negative ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger,
                    lgIntObj = this.instantiateClass(this.specialObjects[lgIntClass], 4),
                    bytes = lgIntObj.bytes;
                bytes[0] = unsigned     & 255;
                bytes[1] = unsigned>>8  & 255;
                bytes[2] = unsigned>>16 & 255;
                bytes[3] = unsigned>>24 & 255;
                this.popNandPush(2, lgIntObj);
                return true;
            }
        }
        return false;
    },
    pop2AndPushBoolResult: function(boolResult) {
        if (!this.success) return false;
        this.popNandPush(2, boolResult ? this.trueObj : this.falseObj);
        return true;
    },
},
'numbers', {
    getClass: function(obj) {
        if (this.isSmallInt(obj))
            return this.specialObjects[Squeak.splOb_ClassInteger];
        return obj.sqClass;
    },
    canBeSmallInt: function(anInt) {
        return (anInt >= Squeak.MinSmallInt) && (anInt <= Squeak.MaxSmallInt);
    },
    isSmallInt: function(object) {
        return typeof object === "number";
    },
    checkSmallInt: function(maybeSmallInt) { // returns an int and sets success
        if (typeof maybeSmallInt === "number")
            return maybeSmallInt;
        this.success = false;
        return 1;
    },
    quickDivide: function(rcvr, arg) { // must only handle exact case
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        var result = rcvr / arg | 0;
        if (result * arg === rcvr) return result;
        return Squeak.NonSmallInt;     // fail if result is not exact
    },
    div: function(rcvr, arg) {
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        return Math.floor(rcvr/arg);
    },
    mod: function(rcvr, arg) {
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        return rcvr - Math.floor(rcvr/arg) * arg;
    },
    safeShift: function(smallInt, shiftCount) {
         // JS shifts only up to 31 bits
        if (shiftCount < 0) {
            if (shiftCount < -31) return smallInt < 0 ? -1 : 0;
            return smallInt >> -shiftCount; // OK to lose bits shifting right
        }
        if (shiftCount > 31) return smallInt == 0 ? 0 : Squeak.NonSmallInt;
        // check for lost bits by seeing if computation is reversible
        var shifted = smallInt << shiftCount;
        if  ((shifted>>shiftCount) === smallInt) return shifted;
        return Squeak.NonSmallInt;  //non-small result will cause failure
    },
},
'utils',
{
    isContext: function(obj) {//either block or methodContext
        if (obj.sqClass === this.specialObjects[Squeak.splOb_ClassMethodContext]) return true;
        if (obj.sqClass === this.specialObjects[Squeak.splOb_ClassBlockContext]) return true;
        return false;
    },
    isMethodContext: function(obj) {
        return obj.sqClass === this.specialObjects[Squeak.splOb_ClassMethodContext];
    },
    instantiateClass: function(aClass, indexableSize) {
        return this.image.instantiateClass(aClass, indexableSize, this.nilObj);
    },
    arrayFill: function(array, fromIndex, toIndex, value) {
        // assign value to range from fromIndex (inclusive) to toIndex (exclusive)
        for (var i = fromIndex; i < toIndex; i++)
            array[i] = value;
    },
    arrayCopy: function(src, srcPos, dest, destPos, length) {
        // copy length elements from src at srcPos to dest at destPos
        if (src === dest && srcPos < destPos)
            for (var i = length - 1; i >= 0; i--)
                dest[destPos + i] = src[srcPos + i];
        else
            for (var i = 0; i < length; i++)
                dest[destPos + i] = src[srcPos + i];
    },
},
'debugging', {
    addMessage: function(message) {
        return this.messages[message] ? ++this.messages[message] : this.messages[message] = 1;
    },
    warnOnce: function(message, what) {
        if (this.addMessage(message) == 1)
            console[what || "warn"](message);
    },
    printMethod: function(aMethod, optContext, optSel) {
        // return a 'class>>selector' description for the method
        if (aMethod.sqClass != this.specialObjects[Squeak.splOb_ClassCompiledMethod]) {
          return this.printMethod(aMethod.blockOuterCode(), optContext, optSel)
        }
        if (optSel) return optContext.className() + '>>' + optSel.bytesAsString();
        // this is expensive, we have to search all classes
        if (!aMethod) aMethod = this.activeContext.contextMethod();
        var found;
        this.allMethodsDo(function(classObj, methodObj, selectorObj) {
            if (methodObj === aMethod)
                return found = classObj.className() + '>>' + selectorObj.bytesAsString();
        });
        if (found) return found;
        if (optContext) {
            var rcvr = optContext.pointers[Squeak.Context_receiver];
            return "(" + rcvr + ")>>?";
        }
        return "?>>?";
    },
    allInstancesOf: function(classObj, callback) {
        if (typeof classObj === "string") classObj = this.globalNamed(classObj);
        var instances = [],
            inst = this.image.someInstanceOf(classObj);
        while (inst) {
            if (callback) callback(inst);
            else instances.push(inst);
            inst = this.image.nextInstanceAfter(inst);
        }
        return instances;
    },
    globalNamed: function(name) {
        return this.allGlobalsDo(function(nameObj, globalObj){
            if (nameObj.bytesAsString() === name) return globalObj;
        });
    },
    allGlobalsDo: function(callback) {
        // callback(globalNameObj, globalObj), truish result breaks out of iteration
        var globals = this.globals;
        for (var i = 0; i < globals.length; i++) {
            var assn = globals[i];
            if (!assn.isNil) {
                var result = callback(assn.pointers[0], assn.pointers[1]);
                if (result) return result;
            }
        }
    },
    allMethodsDo: function(callback) {
        // callback(classObj, methodObj, selectorObj), truish result breaks out of iteration
        this.allGlobalsDo(function(globalNameObj, globalObj) {
            if (globalObj.pointers && globalObj.pointers.length >= 9) {
                var clsAndMeta = [globalObj, globalObj.sqClass];
                for (var c = 0; c < clsAndMeta.length; c++) {
                    var cls = clsAndMeta[c];
                    var mdict = cls.pointers[1];
                    if (!mdict.pointers || !mdict.pointers[1]) continue;
                    var methods = mdict.pointers[1].pointers;
                    if (!methods) continue;
                    var selectors = mdict.pointers;
                    if (methods.length + 2 !== selectors.length) continue;
                    for (var j = 0; j < methods.length; j++) {
                        var method = methods[j];
                        var selector = selectors[2+j];
                        if (!method.isMethod || !method.isMethod()) continue;
                        if (!selector.bytesSize || !selector.bytesSize()) continue;
                        var result = callback.call(null, cls, method, selector);
                        if (result) return true;
                    }
                }
            }
        });
    },
    printStack: function(ctx, limit) {
        // both args are optional
        if (typeof ctx == "number") {limit = ctx; ctx = null;}
        if (!ctx) ctx = this.activeContext;
        if (!limit) limit = 100;
        var contexts = [],
            hardLimit = Math.max(limit, 1000000);
        while (!ctx.isNil && hardLimit-- > 0) {
            contexts.push(ctx);
            ctx = ctx.pointers[Squeak.Context_sender];
        }
        var extra = 200;
        if (contexts.length > limit + extra) {
            if (!ctx.isNil) contexts.push('...'); // over hard limit
            contexts = contexts.slice(0, limit).concat(['...']).concat(contexts.slice(-extra));
        }
        var stack = [],
            i = contexts.length;
        while (i-- > 0) {
            var ctx = contexts[i];
            if (!ctx.pointers) {
                stack.push('...\n');
            } else {
                var block = '',
                    method = ctx.pointers[Squeak.Context_method];
                if (typeof method === 'number') { // it's a block context, fetch home
                    method = ctx.pointers[Squeak.BlockContext_home].pointers[Squeak.Context_method];
                    block = '[] in ';
                } else if (!ctx.pointers[Squeak.Context_closure].isNil) {
                    block = '[] in '; // it's a closure activation
                }
                stack.push(block + this.printMethod(method, ctx) + '\n');
            }
        }
        return stack.join('');
    },
    findMethod: function(classAndMethodString) {
        // classAndMethodString is 'Class>>method'
        var found,
            className = classAndMethodString.split('>>')[0],
            methodName = classAndMethodString.split('>>')[1];
        this.allMethodsDo(function(classObj, methodObj, selectorObj) {
            if (methodName.length == selectorObj.bytesSize()
                && methodName == selectorObj.bytesAsString()
                && className == classObj.className())
                    return found = methodObj;
        });
        return found;
    },
    breakNow: function(msg) {
        if (msg) console.log("Break: " + msg);
        this.breakOutOfInterpreter = 'break';
    },
    breakOn: function(classAndMethodString) {
        // classAndMethodString is 'Class>>method'
        return this.breakOnMethod = classAndMethodString && this.findMethod(classAndMethodString);
    },
    breakOnReturnFromThisContext: function() {
        this.breakOnContextChanged = false;
        this.breakOnContextReturned = this.activeContext;
    },
    breakOnSendOrReturn: function() {
        this.breakOnContextChanged = true;
        this.breakOnContextReturned = null;
    },
    printActiveContext: function(maxWidth) {
        if (!maxWidth) maxWidth = 72;
        function printObj(obj) {
            var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
            value = JSON.stringify(value).slice(1, -1);
            if (value.length > maxWidth - 3) value = value.slice(0, maxWidth - 3) + '...';
            return value;
        }
        // temps and stack in current context
        var ctx = this.activeContext;
        var isBlock = typeof ctx.pointers[Squeak.BlockContext_argumentCount] === 'number';
        var closure = ctx.pointers[Squeak.Context_closure];
        var isClosure = !isBlock && !closure.isNil;
        var homeCtx = isBlock ? ctx.pointers[Squeak.BlockContext_home] : ctx;
        var tempCount = isClosure
            ? closure.pointers[Squeak.Closure_numArgs]
            : homeCtx.pointers[Squeak.Context_method].methodTempCount();
        var stackBottom = this.decodeSqueakSP(0);
        var stackTop = homeCtx.contextSizeWithStack(this) - 1;
        var firstTemp = stackBottom + 1;
        var lastTemp = firstTemp + tempCount - 1;
        var stack = '';
        for (var i = stackBottom; i <= stackTop; i++) {
            var value = printObj(homeCtx.pointers[i]);
            var label = '';
            if (i == stackBottom) label = '=rcvr'; else
            if (i <= lastTemp) label = '=tmp' + (i - firstTemp);
            stack += '\nctx[' + i + ']' + label +': ' + value;
        }
        if (isBlock) {
            stack += '\n';
            var nArgs = ctx.pointers[3];
            var firstArg = this.decodeSqueakSP(1);
            var lastArg = firstArg + nArgs;
            for (var i = firstArg; i <= this.sp; i++) {
                var value = printObj(ctx.pointers[i]);
                var label = '';
                if (i <= lastArg) label = '=arg' + (i - firstArg);
                stack += '\nblk[' + i + ']' + label +': ' + value;
            }
        }
        return stack;
    },
    printAllProcesses: function() {
        var schedAssn = this.specialObjects[Squeak.splOb_SchedulerAssociation],
            sched = schedAssn.pointers[Squeak.Assn_value];
        // print active process
        var activeProc = sched.pointers[Squeak.ProcSched_activeProcess],
            result = "Active: " + this.printProcess(activeProc, true);
        // print other runnable processes
        var lists = sched.pointers[Squeak.ProcSched_processLists].pointers;
        for (var priority = lists.length - 1; priority >= 0; priority--) {
            var process = lists[priority].pointers[Squeak.LinkedList_firstLink];
            while (!process.isNil) {
                result += "\nRunnable: " + this.printProcess(process);
                process = process.pointers[Squeak.Link_nextLink];
            }
        }
        // print all processes waiting on a semaphore
        var semaClass = this.specialObjects[Squeak.splOb_ClassSemaphore],
            sema = this.image.someInstanceOf(semaClass);
        while (sema) {
            var process = sema.pointers[Squeak.LinkedList_firstLink];
            while (!process.isNil) {
                result += "\nWaiting: " + this.printProcess(process);
                process = process.pointers[Squeak.Link_nextLink];
            }
            sema = this.image.nextInstanceAfter(sema);
        }
        return result;
    },
    printProcess: function(process, active) {
        var context = process.pointers[Squeak.Proc_suspendedContext],
            priority = process.pointers[Squeak.Proc_priority],
            stack = this.printStack(active ? null : context);
        return process.toString() +" at priority " + priority + "\n" + stack;
    },
    printByteCodes: function(aMethod, optionalIndent, optionalHighlight, optionalPC) {
        if (!aMethod) aMethod = this.method;
        var printer = new Squeak.InstructionPrinter(aMethod, this);
        return printer.printInstructions(optionalIndent, optionalHighlight, optionalPC);
    },
    willSendOrReturn: function() {
        // Answer whether the next bytecode corresponds to a Smalltalk
        // message send or return
        var byte = this.method.bytes[this.pc];
        if (this.method.methodSignFlag()) {
          if (0x60 <= byte && byte <= 0x7F) {
            selectorObj = this.specialSelectors[2 * (byte - 0x60)];
          } else if (0x80 <= byte && byte <= 0xAF) {
            selectorObj = this.method.methodGetSelector(byte&0xF);
          } else if (byte == 0xEA || byte == 0xEB) {
            this.method.methodGetSelector((this.method.bytes[this.pc+1] >> 3)); // (extA << 5)
          } else if (0x58 <= byte && byte <= 0x5E) {
            return true; // return
          }
        } else {
          if (byte >= 120 && byte <= 125) return true; // return
          if (byte < 131 || byte == 200) return false;
          if (byte >= 176) return true; // special send or short send
          if (byte <= 134) {         // long sends
            // long form support demands we check the selector
            var litIndex;
            if (byte === 132) {
              if ((this.method.bytes[this.pc + 1] >> 5) > 1) return false;
              litIndex = this.method.bytes[this.pc + 2];
            } else
              litIndex = this.method.bytes[this.pc + 1] & (byte === 134 ? 63 : 31);
            var selectorObj = this.method.methodGetLiteral(litIndex);
            if (selectorObj.bytesAsString() !== 'blockCopy:') return true;
          }
        }
        return false;
    },
    nextSendSelector: function() {
        // if the next bytecode corresponds to a Smalltalk
        // message send, answer the selector
        var byte = this.method.bytes[this.pc];
        var selectorObj;
        if (this.method.methodSignFlag()) {
          if (0x60 <= byte && byte <= 0x7F) {
            selectorObj = this.specialSelectors[2 * (byte - 0x60)];
          } else if (0x80 <= byte && byte <= 0xAF) {
            selectorObj = this.method.methodGetSelector(byte&0xF);
          } else if (byte == 0xEA || byte == 0xEB) {
            this.method.methodGetSelector((this.method.bytes[this.pc+1] >> 3)); // (extA << 5)
          } else {
            return null;
          }
        } else {
          if (byte < 131 || byte == 200) return null;
          if (byte >= 0xD0 ) {
            selectorObj = this.method.methodGetLiteral(byte & 0x0F);
          } else if (byte >= 0xB0 ) {
            selectorObj = this.specialSelectors[2 * (byte - 0xB0)];
          } else if (byte <= 134) {
            // long form support demands we check the selector
            var litIndex;
            if (byte === 132) {
                if ((this.method.bytes[this.pc + 1] >> 5) > 1) return null;
                litIndex = this.method.bytes[this.pc + 2];
            } else
                litIndex = this.method.bytes[this.pc + 1] & (byte === 134 ? 63 : 31);
            selectorObj = this.method.methodGetLiteral(litIndex);
          }
        }
        if (selectorObj) {
          var selector = selectorObj.bytesAsString();
          if (selector !== 'blockCopy:') return selector;
        }
    },
});
