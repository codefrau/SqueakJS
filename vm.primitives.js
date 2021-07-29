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

Object.subclass('Squeak.Primitives',
'initialization', {
    initialize: function(vm, display) {
        this.vm = vm;
        this.oldPrims = !this.vm.image.hasClosures;
        this.allowAccessBeyondSP = this.oldPrims;
        this.deferDisplayUpdates = false;
        this.semaphoresToSignal = [];
        this.initDisplay(display);
        this.initAtCache();
        this.initModules();
        this.initPlugins();
        if (vm.image.isSpur) {
            this.charFromInt = this.charFromIntSpur;
            this.charToInt = this.charToIntSpur;
            this.identityHash = this.identityHashSpur;
        }
    },
    initDisplay: function(display) {
        // Placeholder (can be replaced by a display module at runtime, before starting the Squeak interpreter)
        this.display = display;
    },
    initModules: function() {
        this.loadedModules = {};
        this.builtinModules = {};
        this.patchModules = {};
        this.interpreterProxy = new Squeak.InterpreterProxy(this.vm);
    },
    initPlugins: function() {
        // Empty placeholder (can be replaced by a plugins module at runtime, before starting the Squeak interpreter)
    }
},
'dispatch', {
    quickSendOther: function(rcvr, lobits) {
        // returns true if it succeeds
        this.success = true;
        switch (lobits) {
            case 0x0: return this.popNandPushIfOK(2, this.objectAt(true,true,false)); // at:
            case 0x1: return this.popNandPushIfOK(3, this.objectAtPut(true,true,false)); // at:put:
            case 0x2: return this.popNandPushIfOK(1, this.objectSize(true)); // size
            //case 0x3: return false; // next
            //case 0x4: return false; // nextPut:
            //case 0x5: return false; // atEnd
            case 0x6: return this.pop2andPushBoolIfOK(this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 0x7: return this.popNandPushIfOK(1,this.vm.getClass(this.vm.top())); // class
            case 0x8: return this.popNandPushIfOK(2,this.doBlockCopy()); // blockCopy:
            case 0x9: return this.primitiveBlockValue(0); // value
            case 0xA: return this.primitiveBlockValue(1); // value:
            //case 0xB: return false; // do:
            //case 0xC: return false; // new
            //case 0xD: return false; // new:
            //case 0xE: return false; // x
            //case 0xF: return false; // y
        }
        return false;
    },
    doPrimitive: function(index, argCount, primMethod) {
        this.success = true;
        switch (index) {
            // Integer Primitives (0-19)
            case 1: return this.popNandPushIntIfOK(2,this.stackInteger(1) + this.stackInteger(0));  // Integer.add
            case 2: return this.popNandPushIntIfOK(2,this.stackInteger(1) - this.stackInteger(0));  // Integer.subtract
            case 3: return this.pop2andPushBoolIfOK(this.stackInteger(1) < this.stackInteger(0));   // Integer.less
            case 4: return this.pop2andPushBoolIfOK(this.stackInteger(1) > this.stackInteger(0));   // Integer.greater
            case 5: return this.pop2andPushBoolIfOK(this.stackInteger(1) <= this.stackInteger(0));  // Integer.leq
            case 6: return this.pop2andPushBoolIfOK(this.stackInteger(1) >= this.stackInteger(0));  // Integer.geq
            case 7: return this.pop2andPushBoolIfOK(this.stackInteger(1) === this.stackInteger(0)); // Integer.equal
            case 8: return this.pop2andPushBoolIfOK(this.stackInteger(1) !== this.stackInteger(0)); // Integer.notequal
            case 9: return this.popNandPushIntIfOK(2,this.stackInteger(1) * this.stackInteger(0));  // Integer.multiply *
            case 10: return this.popNandPushIntIfOK(2,this.vm.quickDivide(this.stackInteger(1),this.stackInteger(0)));  // Integer.divide /  (fails unless exact)
            case 11: return this.popNandPushIntIfOK(2,this.vm.mod(this.stackInteger(1),this.stackInteger(0)));  // Integer.mod \\
            case 12: return this.popNandPushIntIfOK(2,this.vm.div(this.stackInteger(1),this.stackInteger(0)));  // Integer.div //
            case 13: return this.popNandPushIntIfOK(2,this.stackInteger(1) / this.stackInteger(0) | 0);  // Integer.quo
            case 14: return this.popNandPushIfOK(2,this.doBitAnd());  // SmallInt.bitAnd
            case 15: return this.popNandPushIfOK(2,this.doBitOr());  // SmallInt.bitOr
            case 16: return this.popNandPushIfOK(2,this.doBitXor());  // SmallInt.bitXor
            case 17: return this.popNandPushIfOK(2,this.doBitShift());  // SmallInt.bitShift
            case 18: return this.primitiveMakePoint(argCount, false);
            case 19: return false;                                 // Guard primitive for simulation -- *must* fail
            // LargeInteger Primitives (20-39)
            // 32-bit logic is aliased to Integer prims above
            case 20: this.vm.warnOnce("missing primitive: 20 (primitiveRemLargeIntegers)"); return false;
            case 21: this.vm.warnOnce("missing primitive: 21 (primitiveAddLargeIntegers)"); return false;
            case 22: this.vm.warnOnce("missing primitive: 22 (primitiveSubtractLargeIntegers)"); return false;
            case 23: return this.primitiveLessThanLargeIntegers();
            case 24: return this.primitiveGreaterThanLargeIntegers();
            case 25: return this.primitiveLessOrEqualLargeIntegers();
            case 26: return this.primitiveGreaterOrEqualLargeIntegers();
            case 27: return this.primitiveEqualLargeIntegers();
            case 28: return this.primitiveNotEqualLargeIntegers();
            case 29: this.vm.warnOnce("missing primitive: 29 (primitiveMultiplyLargeIntegers)"); return false;
            case 30: this.vm.warnOnce("missing primitive: 30 (primitiveDivideLargeIntegers)"); return false;
            case 31: this.vm.warnOnce("missing primitive: 31 (primitiveModLargeIntegers)"); return false;
            case 32: this.vm.warnOnce("missing primitive: 32 (primitiveDivLargeIntegers)"); return false;
            case 33: this.vm.warnOnce("missing primitive: 33 (primitiveQuoLargeIntegers)"); return false;
            case 34: this.vm.warnOnce("missing primitive: 34 (primitiveBitAndLargeIntegers)"); return false;
            case 35: this.vm.warnOnce("missing primitive: 35 (primitiveBitOrLargeIntegers)"); return false;
            case 36: this.vm.warnOnce("missing primitive: 36 (primitiveBitXorLargeIntegers)"); return false;
            case 37: this.vm.warnOnce("missing primitive: 37 (primitiveBitShiftLargeIntegers)"); return false;
            case 38: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,false)); // Float basicAt
            case 39: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,false)); // Float basicAtPut
            // Float Primitives (40-59)
            case 40: return this.popNandPushFloatIfOK(argCount+1,this.stackInteger(0)); // primitiveAsFloat
            case 41: return this.popNandPushFloatIfOK(argCount+1,this.stackFloat(1)+this.stackFloat(0));  // Float +
            case 42: return this.popNandPushFloatIfOK(argCount+1,this.stackFloat(1)-this.stackFloat(0));  // Float -
            case 43: return this.pop2andPushBoolIfOK(this.stackFloat(1)<this.stackFloat(0));  // Float <
            case 44: return this.pop2andPushBoolIfOK(this.stackFloat(1)>this.stackFloat(0));  // Float >
            case 45: return this.pop2andPushBoolIfOK(this.stackFloat(1)<=this.stackFloat(0));  // Float <=
            case 46: return this.pop2andPushBoolIfOK(this.stackFloat(1)>=this.stackFloat(0));  // Float >=
            case 47: return this.pop2andPushBoolIfOK(this.stackFloat(1)===this.stackFloat(0));  // Float =
            case 48: return this.pop2andPushBoolIfOK(this.stackFloat(1)!==this.stackFloat(0));  // Float !=
            case 49: return this.popNandPushFloatIfOK(argCount+1,this.stackFloat(1)*this.stackFloat(0));  // Float.mul
            case 50: return this.popNandPushFloatIfOK(argCount+1,this.safeFDiv(this.stackFloat(1),this.stackFloat(0)));  // Float.div
            case 51: return this.popNandPushIfOK(argCount+1,this.floatAsSmallInt(this.stackFloat(0)));  // Float.asInteger
            case 52: return this.popNandPushFloatIfOK(argCount+1,this.floatFractionPart(this.stackFloat(0)));
            case 53: return this.popNandPushIntIfOK(argCount+1, this.frexp_exponent(this.stackFloat(0)) - 1); // Float.exponent
            case 54: return this.popNandPushFloatIfOK(2, this.ldexp(this.stackFloat(1), this.stackFloat(0))); // Float.timesTwoPower
            case 55: return this.popNandPushFloatIfOK(argCount+1, Math.sqrt(this.stackFloat(0))); // SquareRoot
            case 56: return this.popNandPushFloatIfOK(argCount+1, Math.sin(this.stackFloat(0))); // Sine
            case 57: return this.popNandPushFloatIfOK(argCount+1, Math.atan(this.stackFloat(0))); // Arctan
            case 58: return this.popNandPushFloatIfOK(argCount+1, Math.log(this.stackFloat(0))); // LogN
            case 59: return this.popNandPushFloatIfOK(argCount+1, Math.exp(this.stackFloat(0))); // Exp
            // Subscript and Stream Primitives (60-67)
            case 60: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,false)); // basicAt:
            case 61: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,false)); // basicAt:put:
            case 62: return this.popNandPushIfOK(argCount+1, this.objectSize(false)); // size
            case 63: return this.popNandPushIfOK(argCount+1, this.objectAt(false,true,false)); // String.basicAt:
            case 64: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,true,false)); // String.basicAt:put:
            case 65: this.vm.warnOnce("missing primitive: 65 (primitiveNext)"); return false;
            case 66: this.vm.warnOnce("missing primitive: 66 (primitiveNextPut)"); return false;
            case 67: this.vm.warnOnce("missing primitive: 67 (primitiveAtEnd)"); return false;
            // StorageManagement Primitives (68-79)
            case 68: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,true)); // Method.objectAt:
            case 69: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,true)); // Method.objectAt:put:
            case 70: return this.popNandPushIfOK(argCount+1, this.instantiateClass(this.stackNonInteger(0), 0)); // Class.new
            case 71: return this.popNandPushIfOK(argCount+1, this.instantiateClass(this.stackNonInteger(1), this.stackPos32BitInt(0))); // Class.new:
            case 72: return this.primitiveArrayBecome(argCount, false, true); // one way, do copy hash
            case 73: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,true)); // instVarAt:
            case 74: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,true)); // instVarAt:put:
            case 75: return this.popNandPushIfOK(argCount+1, this.identityHash(this.stackNonInteger(0))); // Object.identityHash
            case 76: return this.primitiveStoreStackp(argCount);  // (Blue Book: primitiveAsObject)
            case 77: return this.popNandPushIfOK(argCount+1, this.someInstanceOf(this.stackNonInteger(0))); // Class.someInstance
            case 78: return this.popNandPushIfOK(argCount+1, this.nextInstanceAfter(this.stackNonInteger(0))); // Object.nextInstance
            case 79: return this.primitiveNewMethod(argCount); // Compiledmethod.new
            // Control Primitives (80-89)
            case 80: return this.popNandPushIfOK(2,this.doBlockCopy()); // blockCopy:
            case 81: return this.primitiveBlockValue(argCount); // BlockContext.value
            case 82: return this.primitiveBlockValueWithArgs(argCount); // BlockContext.valueWithArguments:
            case 83: return this.vm.primitivePerform(argCount); // Object.perform:(with:)*
            case 84: return this.vm.primitivePerformWithArgs(argCount, false); //  Object.perform:withArguments:
            case 85: return this.primitiveSignal(); // Semaphore.wait
            case 86: return this.primitiveWait(); // Semaphore.wait
            case 87: return this.primitiveResume(); // Process.resume
            case 88: return this.primitiveSuspend(); // Process.suspend
            case 89: return this.vm.flushMethodCache(); //primitiveFlushCache
            // Input/Output Primitives (90-109)
            case 90: return this.primitiveMousePoint(argCount); // mousePoint
            case 91: return this.primitiveTestDisplayDepth(argCount); // cursorLocPut in old images
            case 92: this.vm.warnOnce("missing primitive: 92 (primitiveSetDisplayMode)"); return false;
            case 93: return this.primitiveInputSemaphore(argCount);
            case 94: return this.primitiveGetNextEvent(argCount);
            case 95: return this.primitiveInputWord(argCount);
            case 96: return this.namedPrimitive('BitBltPlugin', 'primitiveCopyBits', argCount);
            case 97: return this.primitiveSnapshot(argCount);
            case 98: this.vm.warnOnce("missing primitive 98 (primitiveStoreImageSegment)"); return false;
            case 99: return this.primitiveLoadImageSegment(argCount);
            case 100: return this.vm.primitivePerformWithArgs(argCount, true); // Object.perform:withArguments:inSuperclass: (Blue Book: primitiveSignalAtTick)
            case 101: return this.primitiveBeCursor(argCount); // Cursor.beCursor
            case 102: return this.primitiveBeDisplay(argCount); // DisplayScreen.beDisplay
            case 103: return this.primitiveScanCharacters(argCount);
            case 104: this.vm.warnOnce("missing primitive: 104 (primitiveDrawLoop)"); return false;
            case 105: return this.popNandPushIfOK(argCount+1, this.doStringReplace()); // string and array replace
            case 106: return this.primitiveScreenSize(argCount); // actualScreenSize
            case 107: return this.primitiveMouseButtons(argCount); // Sensor mouseButtons
            case 108: return this.primitiveKeyboardNext(argCount); // Sensor kbdNext
            case 109: return this.primitiveKeyboardPeek(argCount); // Sensor kbdPeek
            // System Primitives (110-119)
            case 110: return this.pop2andPushBoolIfOK(this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 111: return this.popNandPushIfOK(argCount+1, this.vm.getClass(this.vm.top())); // Object.class
            case 112: return this.popNandPushIfOK(argCount+1, this.vm.image.bytesLeft()); //primitiveBytesLeft
            case 113: return this.primitiveQuit(argCount);
            case 114: return this.primitiveExitToDebugger(argCount);
            case 115: return this.primitiveChangeClass(argCount);
            case 116: return this.vm.flushMethodCacheForMethod(this.vm.top());  // after Squeak 2.2 uses 119
            case 117: return this.doNamedPrimitive(argCount, primMethod); // named prims
            case 118: return this.primitiveDoPrimitiveWithArgs(argCount);
            case 119: return this.vm.flushMethodCacheForSelector(this.vm.top()); // before Squeak 2.3 uses 116
            // Miscellaneous Primitives (120-149)
            case 120: this.vm.warnOnce("missing primitive:121 (primitiveCalloutToFFI)"); return false;
            case 121: return this.primitiveImageName(argCount); //get+set imageName
            case 122: return this.primitiveReverseDisplay(argCount); // Blue Book: primitiveImageVolume
            case 123: this.vm.warnOnce("missing primitive: 123 (primitiveValueUninterruptably)"); return false;
            case 124: return this.popNandPushIfOK(2, this.registerSemaphore(Squeak.splOb_TheLowSpaceSemaphore));
            case 125: return this.popNandPushIfOK(2, this.setLowSpaceThreshold());
            case 126: return this.primitiveDeferDisplayUpdates(argCount);
            case 127: return this.primitiveShowDisplayRect(argCount);
            case 128: return this.primitiveArrayBecome(argCount, true, true); // both ways, do copy hash
            case 129: return this.popNandPushIfOK(1, this.vm.image.specialObjectsArray); //specialObjectsOop
            case 130: return this.primitiveFullGC(argCount);
            case 131: return this.primitivePartialGC(argCount);
            case 132: return this.pop2andPushBoolIfOK(this.pointsTo(this.stackNonInteger(1), this.vm.top())); //Object.pointsTo
            case 133: return this.popNIfOK(argCount); //TODO primitiveSetInterruptKey
            case 134: return this.popNandPushIfOK(2, this.registerSemaphore(Squeak.splOb_TheInterruptSemaphore));
            case 135: return this.popNandPushIfOK(1, this.millisecondClockValue());
            case 136: return this.primitiveSignalAtMilliseconds(argCount); //Delay signal:atMs:();
            case 137: return this.popNandPushIfOK(1, this.secondClock()); // seconds since Jan 1, 1901
            case 138: return this.popNandPushIfOK(argCount+1, this.someObject()); // Object.someObject
            case 139: return this.popNandPushIfOK(argCount+1, this.nextObject(this.vm.top())); // Object.nextObject
            case 140: return this.primitiveBeep(argCount);
            case 141: return this.primitiveClipboardText(argCount);
            case 142: return this.popNandPushIfOK(argCount+1, this.makeStString(this.filenameToSqueak(Squeak.vmPath)));
            case 143: // short at and shortAtPut
            case 144: return this.primitiveShortAtAndPut(argCount);
            case 145: return this.primitiveConstantFill(argCount);
            case 146: return this.namedPrimitive('JoystickTabletPlugin', 'primitiveReadJoystick', argCount);
            case 147: return this.namedPrimitive('BitBltPlugin', 'primitiveWarpBits', argCount);
            case 148: return this.popNandPushIfOK(argCount+1, this.vm.image.clone(this.vm.top())); //shallowCopy
            case 149: return this.primitiveGetAttribute(argCount);
            // File Primitives (150-169)
            case 150: if (this.oldPrims) return this.primitiveFileAtEnd(argCount);
            case 151: if (this.oldPrims) return this.primitiveFileClose(argCount);
            case 152: if (this.oldPrims) return this.primitiveFileGetPosition(argCount);
            case 153: if (this.oldPrims) return this.primitiveFileOpen(argCount);
            case 154: if (this.oldPrims) return this.primitiveFileRead(argCount);
            case 155: if (this.oldPrims) return this.primitiveFileSetPosition(argCount);
            case 156: if (this.oldPrims) return this.primitiveFileDelete(argCount);
            case 157: if (this.oldPrims) return this.primitiveFileSize(argCount);
                break;  // fail 150-157 if fell through
            case 158: if (this.oldPrims) return this.primitiveFileWrite(argCount);
                else this.vm.warnOnce("missing primitive: 158 (primitiveCompareWith)"); return false;
            case 159: if (this.oldPrims) return this.primitiveFileRename(argCount);
                return this.popNandPushIntIfOK(argCount+1, this.stackSigned53BitInt(0) * 1664525 & 0xFFFFFFF); // primitiveHashMultiply
            case 160: if (this.oldPrims) return this.primitiveDirectoryCreate(argCount);
                else return this.primitiveAdoptInstance(argCount);
            case 161: if (this.oldPrims) return this.primitiveDirectoryDelimitor(argCount);
                this.vm.warnOnce("missing primitive: 161 (primitiveSetIdentityHash)"); return false;
            case 162: if (this.oldPrims) return this.primitiveDirectoryLookup(argCount);
                break;  // fail
            case 163: if (this.oldPrims) return this.primitiveDirectoryDelete(argCount);
                else this.vm.warnOnce("missing primitive: 163 (primitiveGetImmutability)"); return false;
            case 164: return this.popNandPushIfOK(argCount+1, this.vm.trueObj); // Fake primitiveSetImmutability
            case 165:
            case 166: return this.primitiveIntegerAtAndPut(argCount);
            case 167: return false; // Processor.yield
            case 168: return this.primitiveCopyObject(argCount);
            case 169: if (this.oldPrims) return this.primitiveDirectorySetMacTypeAndCreator(argCount);
                else return this.pop2andPushBoolIfOK(this.vm.stackValue(1) !== this.vm.stackValue(0)); //new: primitiveNotIdentical
            // Sound Primitives (170-199)
            case 170: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStart', argCount);
                else return this.primitiveAsCharacter(argCount);
            case 171: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartWithSemaphore', argCount);
                else return this.popNandPushIfOK(argCount+1, this.stackNonInteger(0).hash); //primitiveImmediateAsInteger
            case 172: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStop', argCount);
                this.vm.warnOnce("missing primitive: 172 (primitiveFetchMourner)");
                return this.popNandPushIfOK(argCount, this.vm.nilObj); // do not fail
            case 173: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundAvailableSpace', argCount);
                else return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,true)); // slotAt:
            case 174: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySamples', argCount);
                else return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,true)); // slotAt:put:
            case 175: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySilence', argCount);
                else return this.popNandPushIfOK(argCount+1, this.behaviorHash(this.stackNonInteger(0)));
            case 176: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primWaveTableSoundmixSampleCountintostartingAtpan', argCount);
                else return this.popNandPushIfOK(argCount+1, this.vm.image.isSpur ? 0x3FFFFF : 0xFFF); // primitiveMaxIdentityHash
            case 177: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primFMSoundmixSampleCountintostartingAtpan', argCount);
                return this.popNandPushIfOK(argCount+1, this.allInstancesOf(this.stackNonInteger(0)));
            case 178: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primPluckedSoundmixSampleCountintostartingAtpan', argCount);
                return false; // allObjectsDo fallback code is just as fast and uses less memory
            case 179: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primSampledSoundmixSampleCountintostartingAtpan', argCount);
                break;  // fail
            case 180: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixFMSound', argCount);
                return false; // growMemoryByAtLeast
            case 181: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixPluckedSound', argCount);
                return this.primitiveSizeInBytesOfInstance(argCount);
            case 182: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'oldprimSampledSoundmixSampleCountintostartingAtleftVolrightVol', argCount);
                return this.primitiveSizeInBytes(argCount);
            case 183: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveApplyReverb', argCount);
                break;  // fail
            case 184: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixLoopedSampledSound', argCount);
                break; // fail
            case 185: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixSampledSound', argCount);
                else return this.primitiveExitCriticalSection(argCount);
            case 186: if (this.oldPrims) break; // unused
                else return this.primitiveEnterCriticalSection(argCount);
            case 187: if (this.oldPrims) break; // unused
                else return this.primitiveTestAndSetOwnershipOfCriticalSection(argCount);
            case 188: if (this.oldPrims) break; // unused
                else return this.primitiveExecuteMethodArgsArray(argCount);
            case 189: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundInsertSamples', argCount);
                return false; // fail to fall back to primitiveExecuteMethodArgsArray (188)
            case 190: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartRecording', argCount);
            case 191: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStopRecording', argCount);
            case 192: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundGetRecordingSampleRate', argCount);
            case 193: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundRecordSamples', argCount);
            case 194: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundSetRecordLevel', argCount);
                break;  // fail 190-194 if fell through
            case 195: return false; // Context.findNextUnwindContextUpTo:
            case 196: return false; // Context.terminateTo:
            case 197: return false; // Context.findNextHandlerContextStarting
            case 198: return false; // MarkUnwindMethod (must fail)
            case 199: return false; // MarkHandlerMethod (must fail)
            // Networking Primitives (200-229)
            case 200: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveInitializeNetwork', argCount);
                else return this.primitiveClosureCopyWithCopiedValues(argCount);
            case 201: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartNameLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 202: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverNameLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 203: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartAddressLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 204: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAddressLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 205: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAbortLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 206: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverLocalAddress', argCount);
                else return  this.primitiveClosureValueWithArgs(argCount);
            case 207: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStatus', argCount);
                else return this.primitiveFullClosureValue(argCount);
            case 208: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverError', argCount);
                else return this.primitiveFullClosureValueWithArgs(argCount);
            case 209: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCreate', argCount);
                else return this.primitiveFullClosureValueNoContextSwitch(argCount);
            case 210: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketDestroy', argCount);
                else return this.popNandPushIfOK(2, this.objectAt(false,false,false)); // contextAt:
            case 211: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectionStatus', argCount);
                else return this.popNandPushIfOK(3, this.objectAtPut(false,false,false)); // contextAt:put:
            case 212: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketError', argCount);
                else return this.popNandPushIfOK(1, this.objectSize(false)); // contextSize
            case 213: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalAddress', argCount);
            case 214: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalPort', argCount);
            case 215: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemoteAddress', argCount);
            case 216: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemotePort', argCount);
            case 217: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectToPort', argCount);
            case 218: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketListenOnPort', argCount);
            case 219: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCloseConnection', argCount);
            case 220: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketAbortConnection', argCount);
                break;  // fail 212-220 if fell through
            case 221: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataBufCount', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 222: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataAvailable', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 223: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDataBufCount', argCount);
            case 224: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDone', argCount);
                break;  // fail 223-229 if fell through
            // 225-229: unused
            // Other Primitives (230-249)
            case 230: return this.primitiveRelinquishProcessorForMicroseconds(argCount);
            case 231: return this.primitiveForceDisplayUpdate(argCount);
            case 232: this.vm.warnOnce("missing primitive: 232 (primitiveFormPrint)"); return false;
            case 233: return this.primitiveSetFullScreen(argCount);
            case 234: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveDecompressFromByteArray', argCount);
            case 235: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompareString', argCount);
            case 236: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveConvert8BitSigned', argCount);
            case 237: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompressToByteArray', argCount);
            case 238: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortOpen', argCount);
            case 239: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortClose', argCount);
                break;  // fail 234-239 if fell through
            case 240: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortWrite', argCount);
                else return this.popNandPushIfOK(1, this.microsecondClockUTC());
            case 241: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortRead', argCount);
                else return this.popNandPushIfOK(1, this.microsecondClockLocal());
            case 242: if (this.oldPrims) break; // unused
                else return this.primitiveSignalAtUTCMicroseconds(argCount);
            case 243: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveTranslateStringWithTable', argCount);
                else this.vm.warnOnce("missing primitive: 243 (primitiveUpdateTimeZone)"); return false;
            case 244: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindFirstInString' , argCount);
            case 245: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveIndexOfAsciiInString', argCount);
            case 246: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindSubstring', argCount);
                break;  // fail 243-246 if fell through
            // 247: unused
            case 248: return this.primitiveArrayBecome(argCount, false, false); // one way, do not copy hash
            case 249: return this.primitiveArrayBecome(argCount, false, true); // one way, opt. copy hash
            case 254: return this.primitiveVMParameter(argCount);
            //MIDI Primitives (520-539)
            case 521: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIClosePort', argCount);
            case 522: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetClock', argCount);
            case 523: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortCount', argCount);
            case 524: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortDirectionality', argCount);
            case 525: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortName', argCount);
            case 526: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIOpenPort', argCount);
            case 527: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIParameterGetOrSet', argCount);
            case 528: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIRead', argCount);
            case 529: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIWrite', argCount);
            // 530-539: reserved for extended MIDI primitives
            // Sound Codec Primitives
            case 550: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeMono', argCount);
            case 551: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeStereo', argCount);
            case 552: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeMono', argCount);
            case 553: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeStereo', argCount);
            // External primitive support primitives (570-574)
            // case 570: return this.primitiveFlushExternalPrimitives(argCount);
            case 571: return this.primitiveUnloadModule(argCount);
            case 572: return this.primitiveListBuiltinModule(argCount);
            case 573: return this.primitiveListLoadedModule(argCount);
            case 575: this.vm.warnOnce("missing primitive: 575 (primitiveHighBit)"); return false;
            // this is not really a primitive, see findSelectorInClass()
            case 576: return this.vm.primitiveInvokeObjectAsMethod(argCount, primMethod);
        }
        console.error("primitive " + index + " not implemented yet");
        return false;
    },
    namedPrimitive: function(modName, functionName, argCount) {
        // duplicated in loadFunctionFrom()
        var mod = modName === "" ? this : this.loadedModules[modName];
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
        }
        var result = false;
        var sp = this.vm.sp;
        if (mod) {
            this.interpreterProxy.argCount = argCount;
            var primitive = mod[functionName];
            if (typeof primitive === "function") {
                result = mod[functionName](argCount);
            } else if (typeof primitive === "string") {
                // allow late binding for built-ins
                result = this[primitive](argCount);
            } else {
                this.vm.warnOnce("missing primitive: " + modName + "." + functionName);
            }
        } else {
            this.vm.warnOnce("missing module: " + modName + " (" + functionName + ")");
        }
        if ((result === true || (result !== false && this.success)) && this.vm.sp !== sp - argCount && !this.vm.frozen) {
            this.vm.warnOnce("stack unbalanced after primitive " + modName + "." + functionName, "error");
        }
        if (result === true || result === false) return result;
        return this.success;
    },
    doNamedPrimitive: function(argCount, primMethod) {
        if (primMethod.pointersSize() < 2) return false;
        var firstLiteral = primMethod.pointers[1]; // skip method header
        if (firstLiteral.pointersSize() !== 4) return false;
        this.primMethod = primMethod;
        var moduleName = firstLiteral.pointers[0].bytesAsString();
        var functionName = firstLiteral.pointers[1].bytesAsString();
        return this.namedPrimitive(moduleName, functionName, argCount);
    },
    fakePrimitive: function(prim, retVal, argCount) {
        // fake a named primitive
        // prim and retVal need to be curried when used:
        //  this.fakePrimitive.bind(this, "Module.primitive", 42)
        this.vm.warnOnce("faking primitive: " + prim);
        if (retVal === undefined) this.vm.popN(argCount);
        else this.vm.popNandPush(argCount+1, this.makeStObject(retVal));
        return true;
    },
},
'modules', {
    loadModule: function(modName) {
        var mod = Squeak.externalModules[modName] || this.builtinModules[modName] || this.loadModuleDynamically(modName);
        if (!mod) return null;
        if (this.patchModules[modName])
            this.patchModule(mod, modName);
        if (mod.setInterpreter) {
            if (!mod.setInterpreter(this.interpreterProxy)) {
                console.log("Wrong interpreter proxy version: " + modName);
                return null;
            }
        }
        var initFunc = mod.initialiseModule;
        if (typeof initFunc === 'function') {
            mod.initialiseModule();
        } else if (typeof initFunc === 'string') {
            // allow late binding for built-ins
            this[initFunc]();
        }
        if (this.interpreterProxy.failed()) {
            console.log("Module initialization failed: " + modName);
            return null;
        }
        console.log("Loaded module: " + modName);
        return mod;
    },
    loadModuleDynamically: function(modName) {
        // Placeholder (can be replaced by a module loader at runtime, before starting the Squeak interpreter)
        return undefined;
    },
    patchModule: function(mod, modName) {
        var patch = this.patchModules[modName];
        for (var key in patch)
            mod[key] = patch[key];
    },
    unloadModule: function(modName) {
        var mod = this.loadedModules[modName];
        if (!modName || !mod|| mod === this) return null;
        delete this.loadedModules[modName];
        var unloadFunc = mod.unloadModule;
        if (typeof unloadFunc === 'function') {
            mod.unloadModule(this);
        } else if (typeof unloadFunc === 'string') {
            // allow late binding for built-ins
            this[unloadFunc](this);
        }
        console.log("Unloaded module: " + modName);
        return mod;
    },
    loadFunctionFrom: function(functionName, modName) {
        // copy of namedPrimitive() returning the bound function instead of calling it
        var mod = modName === "" ? this : this.loadedModules[modName];
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
        }
        if (!mod) return null;
        var func = mod[functionName];
        if (typeof func === "function") {
            return func.bind(mod);
        } else if (typeof func === "string") {
            return (this[func]).bind(this);
        }
        this.vm.warnOnce("missing primitive: " + modName + "." + functionName);
        return null;
    },
    primitiveUnloadModule: function(argCount) {
        var moduleName = this.stackNonInteger(0).bytesAsString();
        if (!moduleName) return false;
        this.unloadModule(moduleName);
        return this.popNIfOK(argCount);
    },
    primitiveListBuiltinModule: function(argCount) {
        var index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = Object.keys(this.builtinModules);
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(moduleNames[index]));
    },
    primitiveListLoadedModule: function(argCount) {
        var index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = [];
        for (var key in this.loadedModules) {
            var module = this.loadedModules[key];
            if (module) {
                var moduleName = module.getModuleName ? module.getModuleName() : key;
                moduleNames.push(moduleName);
            }
        }
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(moduleNames[index]));
    },
},
'stack access', {
    popNIfOK: function(nToPop) {
        if (!this.success) return false;
        this.vm.popN(nToPop);
        return true;
    },
    pop2andPushBoolIfOK: function(bool) {
        this.vm.success = this.success;
        return this.vm.pop2AndPushBoolResult(bool);
    },
    popNandPushIfOK: function(nToPop, returnValue) {
        if (!this.success || returnValue == null) return false;
        this.vm.popNandPush(nToPop, returnValue);
        return true;
    },
    popNandPushIntIfOK: function(nToPop, returnValue) {
        if (!this.success || !this.vm.canBeSmallInt(returnValue)) return false;
        return this.popNandPushIfOK(nToPop, returnValue);
    },
    popNandPushFloatIfOK: function(nToPop, returnValue) {
        if (!this.success) return false;
        return this.popNandPushIfOK(nToPop, this.makeFloat(returnValue));
    },
    stackNonInteger: function(nDeep) {
        return this.checkNonInteger(this.vm.stackValue(nDeep));
    },
    stackInteger: function(nDeep) {
        return this.checkSmallInt(this.vm.stackValue(nDeep));
    },
    stackPos32BitInt: function(nDeep) {
        return this.positive32BitValueOf(this.vm.stackValue(nDeep));
    },
    pos32BitIntFor: function(signed32) {
        // Return the 32-bit quantity as an unsigned 32-bit integer
        if (signed32 >= 0 && signed32 <= Squeak.MaxSmallInt) return signed32;
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (signed32>>>(8*i)) & 255;
        return lgIntObj;
    },
    pos53BitIntFor: function(longlong) {
        // Return the quantity as an unsigned 64-bit integer
        if (longlong <= 0xFFFFFFFF) return this.pos32BitIntFor(longlong);
        if (longlong > 0x1FFFFFFFFFFFFF) {
            console.warn("Out of range: pos53BitIntFor(" + longlong + ")");
            this.success = false;
            return 0;
        };
        var sz = longlong <= 0xFFFFFFFFFF ? 5 :
                 longlong <= 0xFFFFFFFFFFFF ? 6 :
                 7;
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, sz),
            bytes = lgIntObj.bytes;
        for (var i = 0; i < sz; i++) {
            bytes[i] = longlong & 255;
            longlong /= 256;
        }
        return lgIntObj;
    },
    stackSigned32BitInt: function(nDeep) {
        var stackVal = this.vm.stackValue(nDeep);
        if (typeof stackVal === "number") {   // SmallInteger
            return stackVal;
        }
        if (stackVal.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = stackVal.bytes,
            value = 0;
        for (var i = 0, f = 1; i < 4; i++, f *= 256)
            value += bytes[i] * f;
        if (this.isA(stackVal, Squeak.splOb_ClassLargePositiveInteger) && value <= 0x7FFFFFFF)
            return value;
        if (this.isA(stackVal, Squeak.splOb_ClassLargeNegativeInteger) && -value >= -0x80000000)
            return -value;
        this.success = false;
        return 0;
    },
    signed32BitIntegerFor: function(signed32) {
        // Return the 32-bit quantity as a signed 32-bit integer
        if (signed32 >= Squeak.MinSmallInt && signed32 <= Squeak.MaxSmallInt) return signed32;
        var negative = signed32 < 0,
            unsigned = negative ? -signed32 : signed32,
            lgIntClass = negative ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger,
            lgIntObj = this.vm.instantiateClass(this.vm.specialObjects[lgIntClass], 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (unsigned>>>(8*i)) & 255;
        return lgIntObj;
    },
    stackFloat: function(nDeep) {
        return this.checkFloat(this.vm.stackValue(nDeep));
    },
    stackBoolean: function(nDeep) {
        return this.checkBoolean(this.vm.stackValue(nDeep));
    },
    stackSigned53BitInt:function(nDeep) {
        var stackVal = this.vm.stackValue(nDeep);
        if (typeof stackVal === "number") {   // SmallInteger
            return stackVal;
        }
        var n = stackVal.bytesSize();
        if (n <= 7) {
            var bytes = stackVal.bytes,
                value = 0;
            for (var i = 0, f = 1; i < n; i++, f *= 256)
                value += bytes[i] * f;
            if (value <= 0x1FFFFFFFFFFFFF) {
                if (this.isA(stackVal, Squeak.splOb_ClassLargePositiveInteger))
                    return value;
                if (this.isA(stackVal, Squeak.splOb_ClassLargeNegativeInteger))
                    return -value;
            }
        }
        this.success = false;
        return 0;
    },
},
'numbers', {
    doBitAnd: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr & arg);
    },
    doBitOr: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr | arg);
    },
    doBitXor: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr ^ arg);
    },
    doBitShift: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackInteger(0);
        if (!this.success) return 0;
        var result = this.vm.safeShift(rcvr, arg); // returns negative result if failed
        if (result > 0)
            return this.pos32BitIntFor(this.vm.safeShift(rcvr, arg));
        this.success = false;
        return 0;
    },
    safeFDiv: function(dividend, divisor) {
        if (divisor === 0.0) {
            this.success = false;
            return 1.0;
        }
        return dividend / divisor;
    },
    floatAsSmallInt: function(float) {
        var truncated = float >= 0 ? Math.floor(float) : Math.ceil(float);
        return this.ensureSmallInt(truncated);
    },
    floatFractionPart: function(float) {
        if (-9007199254740991 /* -((1 << 53) - 1) */ <= float && float <= 9007199254740991 /* (1 << 53) - 1 */) {
            return float - Math.floor(float);
        } else {
            this.success = false;
            return 0;
        }
    },
    frexp_exponent: function(value) {
        // frexp separates a float into its mantissa and exponent
        if (value == 0.0) return 0;     // zero is special
        var data = new DataView(new ArrayBuffer(8));
        data.setFloat64(0, value);      // for accessing IEEE-754 exponent bits
        var bits = (data.getUint32(0) >>> 20) & 0x7FF;
        if (bits === 0) { // we have a subnormal float (actual zero was handled above)
            // make it normal by multiplying a large number
            data.setFloat64(0, value * Math.pow(2, 64));
            // access its exponent bits, and subtract the large number's exponent
            bits = ((data.getUint32(0) >>> 20) & 0x7FF) - 64;
        }
        var exponent = bits - 1022;                 // apply bias
        // mantissa = this.ldexp(value, -exponent)  // not needed for Squeak
        return exponent;
    },
    ldexp: function(mantissa, exponent) {
        // construct a float as mantissa * 2 ^ exponent
        // avoid multiplying by Infinity and Zero and rounding errors
        // by splitting the exponent (thanks to Nicolas Cellier)
        // 3 multiplies needed for e.g. ldexp(5e-324, 1023+1074)
        var steps = Math.min(3, Math.ceil(Math.abs(exponent) / 1023));
        var result = mantissa;
        for (var i = 0; i < steps; i++)
            result *= Math.pow(2, Math.floor((exponent + i) / steps));
        return result;
    },
    primitiveLessThanLargeIntegers: function() {
        return this.pop2andPushBoolIfOK(this.stackSigned53BitInt(1) < this.stackSigned53BitInt(0));
    },
    primitiveGreaterThanLargeIntegers: function() {
        return this.pop2andPushBoolIfOK(this.stackSigned53BitInt(1) > this.stackSigned53BitInt(0));
    },
    primitiveLessOrEqualLargeIntegers: function() {
        return this.pop2andPushBoolIfOK(this.stackSigned53BitInt(1) <= this.stackSigned53BitInt(0));
    },
    primitiveGreaterOrEqualLargeIntegers: function() {
        return this.pop2andPushBoolIfOK(this.stackSigned53BitInt(1) >= this.stackSigned53BitInt(0));
    },
    primitiveEqualLargeIntegers: function() {
        return this.pop2andPushBoolIfOK(this.stackSigned53BitInt(1) === this.stackSigned53BitInt(0));
    },
    primitiveNotEqualLargeIntegers: function() {
        return this.pop2andPushBoolIfOK(this.stackSigned53BitInt(1) !== this.stackSigned53BitInt(0));
    },
},
'utils', {
    floatOrInt: function(obj) {
        if (obj.isFloat) return obj.float;
        if (typeof obj === "number") return obj;  // SmallInteger
        return 0;
    },
    positive32BitValueOf: function(obj) {
        if (typeof obj === "number") { // SmallInteger
            if (obj >= 0)
                return obj;
            this.success = false;
            return 0;
        }
        if (!this.isA(obj, Squeak.splOb_ClassLargePositiveInteger) || obj.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = obj.bytes,
            value = 0;
        for (var i = 0, f = 1; i < 4; i++, f *= 256)
            value += bytes[i] * f;
        return value;
    },
    checkFloat: function(maybeFloat) { // returns a number and sets success
        if (maybeFloat.isFloat)
            return maybeFloat.float;
        if (typeof maybeFloat === "number")  // SmallInteger
            return maybeFloat;
        this.success = false;
        return 0.0;
    },
    checkSmallInt: function(maybeSmall) { // returns an int and sets success
        if (typeof maybeSmall === "number")
            return maybeSmall;
        this.success = false;
        return 0;
    },
    checkNonInteger: function(obj) { // returns a SqObj and sets success
        if (typeof obj !== "number")
            return obj;
        this.success = false;
        return this.vm.nilObj;
    },
    checkBoolean: function(obj) { // returns true/false and sets success
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        return this.success = false;
    },
    indexableSize: function(obj) {
        if (typeof obj === "number") return -1; // -1 means not indexable
        return obj.indexableSize(this);
    },
    isA: function(obj, knownClass) {
        return obj.sqClass === this.vm.specialObjects[knownClass];
    },
    isKindOf: function(obj, knownClass) {
        var classOrSuper = obj.sqClass;
        var theClass = this.vm.specialObjects[knownClass];
        while (!classOrSuper.isNil) {
            if (classOrSuper === theClass) return true;
            classOrSuper = classOrSuper.pointers[Squeak.Class_superclass];
        }
        return false;
    },
    isAssociation: function(obj) {
        return typeof obj !== "number" && obj.pointersSize() == 2;
    },
    ensureSmallInt: function(number) {
        if (number === (number|0) && this.vm.canBeSmallInt(number))
            return number;
        this.success = false;
        return 0;
    },
    charFromInt: function(ascii) {
        var charTable = this.vm.specialObjects[Squeak.splOb_CharacterTable];
        var char = charTable.pointers[ascii];
        if (char) return char;
        var charClass = this.vm.specialObjects[Squeak.splOb_ClassCharacter];
        char = this.vm.instantiateClass(charClass, 0);
        char.pointers[0] = ascii;
        return char;
    },
    charFromIntSpur: function(unicode) {
        return this.vm.image.getCharacter(unicode);
    },
    charToInt: function(obj) {
        return obj.pointers[0];
    },
    charToIntSpur: function(obj) {
        return obj.hash;
    },
    makeFloat: function(value) {
        var floatClass = this.vm.specialObjects[Squeak.splOb_ClassFloat];
        var newFloat = this.vm.instantiateClass(floatClass, 2);
        newFloat.float = value;
        return newFloat;
    },
    makeLargeIfNeeded: function(integer) {
        return this.vm.canBeSmallInt(integer) ? integer : this.makeLargeInt(integer);
    },
    makeLargeInt: function(integer) {
        if (integer < 0) throw Error("negative large ints not implemented yet");
        if (integer > 0xFFFFFFFF) throw Error("large large ints not implemented yet");
        return this.pos32BitIntFor(integer);
    },
    makePointWithXandY: function(x, y) {
        var pointClass = this.vm.specialObjects[Squeak.splOb_ClassPoint];
        var newPoint = this.vm.instantiateClass(pointClass, 0);
        newPoint.pointers[Squeak.Point_x] = x;
        newPoint.pointers[Squeak.Point_y] = y;
        return newPoint;
    },
    makeStArray: function(jsArray, proxyClass) {
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], jsArray.length);
        for (var i = 0; i < jsArray.length; i++)
            array.pointers[i] = this.makeStObject(jsArray[i], proxyClass);
        return array;
    },
    makeStByteArray: function(jsArray) {
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassByteArray], jsArray.length);
        for (var i = 0; i < jsArray.length; i++)
            array.bytes[i] = jsArray[i] & 0xff;
        return array;
    },
    makeStString: function(jsString) {
        var stString = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassString], jsString.length);
        for (var i = 0; i < jsString.length; ++i)
            stString.bytes[i] = jsString.charCodeAt(i) & 0xFF;
        return stString;
    },
    makeStObject: function(obj, proxyClass) {
        if (obj === undefined || obj === null) return this.vm.nilObj;
        if (obj === true) return this.vm.trueObj;
        if (obj === false) return this.vm.falseObj;
        if (obj.sqClass) return obj;
        if (typeof obj === "number")
            if (obj === (obj|0)) return this.makeLargeIfNeeded(obj);
            else return this.makeFloat(obj);
        if (proxyClass) {   // wrap in JS proxy instance
            var stObj = this.vm.instantiateClass(proxyClass, 0);
            stObj.jsObject = obj;
            return stObj;
        }
        // A direct test of the buffer's constructor doesn't work on Safari 10.0.
        if (typeof obj === "string" || obj.constructor.name === "Uint8Array") return this.makeStString(obj);
        if (obj.constructor.name === "Array") return this.makeStArray(obj);
        throw Error("cannot make smalltalk object");
    },
    pointsTo: function(rcvr, arg) {
        if (!rcvr.pointers) return false;
        return rcvr.pointers.indexOf(arg) >= 0;
    },
    asUint8Array: function(buffer) {
        // A direct test of the buffer's constructor doesn't work on Safari 10.0.
        if (buffer.constructor.name === "Uint8Array") return buffer;
        if (buffer.constructor.name === "ArrayBuffer") return new Uint8Array(buffer);
        if (typeof buffer === "string") {
            var array = new Uint8Array(buffer.length);
            for (var i = 0; i < buffer.length; i++)
                array[i] = buffer.charCodeAt(i);
            return array;
        }
        throw Error("unknown buffer type");
    },
    filenameToSqueak: function(unixpath) {
        var slash = unixpath[0] !== "/" ? "/" : "",
            filepath = "/SqueakJS" + slash + unixpath;                      // add SqueakJS
        if (this.emulateMac)
            filepath = ("Macintosh HD" + filepath)                          // add Mac volume
                .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        return filepath;
    },
    filenameFromSqueak: function(filepath) {
        var unixpath = !this.emulateMac ? filepath :
            filepath.replace(/^[^:]*:/, ":")                            // remove volume
            .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        unixpath = unixpath.replace(/^\/*SqueakJS\/?/, "/");            // strip SqueakJS /**/
        return unixpath;
    },
},
'indexing', {
    objectAt: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at: or sets success false
        var array = this.stackNonInteger(1);
        var index = this.stackPos32BitInt(0); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var floatData = array.floatData();
                if (index==1) return this.pos32BitIntFor(floatData.getUint32(0, false));
                if (index==2) return this.pos32BitIntFor(floatData.getUint32(4, false));
                this.success = false; return array;
            }
            info = this.makeAtCacheInfo(this.atCache, this.vm.specialSelectors[32], array, convertChars, includeInstVars);
        }
        if (index < 1 || index > info.size) {this.success = false; return array;}
        if (includeInstVars)  //pointers...   instVarAt and objectAt
            return array.pointers[index-1];
        if (array.isPointers())   //pointers...   normal at:
            return array.pointers[index-1+info.ivarOffset];
        if (array.isWords()) // words...
            if (info.convertChars) return this.charFromInt(array.words[index-1] & 0x3FFFFFFF);
            else return this.pos32BitIntFor(array.words[index-1]);
        if (array.isBytes()) // bytes...
            if (info.convertChars) return this.charFromInt(array.bytes[index-1] & 0xFF);
            else return array.bytes[index-1] & 0xFF;
        // methods must simulate Squeak's method indexing
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //reading lits as bytes
        return array.bytes[index-1-offset] & 0xFF;
    },
    objectAtPut: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at:put: or sets success false
        var array = this.stackNonInteger(2);
        var index = this.stackPos32BitInt(1); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atPutCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var wordToPut = this.stackPos32BitInt(0);
                if (this.success && (index == 1 || index == 2)) {
                    var floatData = array.floatData();
                    floatData.setUint32(index == 1 ? 0 : 4, wordToPut, false);
                    array.float = floatData.getFloat64(0);
                } else this.success = false;
                return this.vm.stackValue(0);
            }
            info = this.makeAtCacheInfo(this.atPutCache, this.vm.specialSelectors[34], array, convertChars, includeInstVars);
        }
        if (index<1 || index>info.size) {this.success = false; return array;}
        var objToPut = this.vm.stackValue(0);
        if (includeInstVars)  {// pointers...   instVarAtPut and objectAtPut
            array.dirty = true;
            return array.pointers[index-1] = objToPut; //eg, objectAt:
        }
        if (array.isPointers())  {// pointers...   normal atPut
            array.dirty = true;
            return array.pointers[index-1+info.ivarOffset] = objToPut;
        }
        var intToPut;
        if (array.isWords()) {  // words...
            if (convertChars) {
                // put a character...
                if (objToPut.sqClass !== this.vm.specialObjects[Squeak.splOb_ClassCharacter])
                    {this.success = false; return objToPut;}
                intToPut = this.charToInt(objToPut);
                if (typeof intToPut !== "number") {this.success = false; return objToPut;}
            } else {
                intToPut = this.stackPos32BitInt(0);
            }
            if (this.success) array.words[index-1] = intToPut;
            return objToPut;
        }
        // bytes...
        if (convertChars) {
            // put a character...
            if (objToPut.sqClass !== this.vm.specialObjects[Squeak.splOb_ClassCharacter])
                {this.success = false; return objToPut;}
            intToPut = this.charToInt(objToPut);
            if (typeof intToPut !== "number") {this.success = false; return objToPut;}
        } else { // put a byte...
            if (typeof objToPut !== "number") {this.success = false; return objToPut;}
            intToPut = objToPut;
        }
        if (intToPut<0 || intToPut>255) {this.success = false; return objToPut;}
        if (array.isBytes())  // bytes...
            {array.bytes[index-1] = intToPut; return objToPut;}
        // methods must simulate Squeak's method indexing
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //writing lits as bytes
        array.bytes[index-1-offset] = intToPut;
        return objToPut;
    },
    objectSize: function(cameFromBytecode) {
        var rcvr = this.vm.stackValue(0),
            size = -1;
        if (cameFromBytecode) {
            // must only handle classes with size == basicSize, fail otherwise
            if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray]) {
                size = rcvr.pointersSize();
            } else if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassString]) {
                size = rcvr.bytesSize();
            }
        } else { // basicSize
            size = this.indexableSize(rcvr);
        }
        if (size === -1) {this.success = false; return -1}; //not indexable
        return this.pos32BitIntFor(size);
    },
    initAtCache: function() {
        // The purpose of the at-cache is to allow fast (bytecode) access to at/atput code
        // without having to check whether this object has overridden at, etc.
        this.atCacheSize = 32; // must be power of 2
        this.atCacheMask = this.atCacheSize - 1; //...so this is a mask
        this.atCache = [];
        this.atPutCache = [];
        this.nonCachedInfo = {};
        for (var i= 0; i < this.atCacheSize; i++) {
            this.atCache.push({});
            this.atPutCache.push({});
        }
    },
    makeAtCacheInfo: function(atOrPutCache, atOrPutSelector, array, convertChars, includeInstVars) {
        //Make up an info object and store it in the atCache or the atPutCache.
        //If it's not cacheable (not a non-super send of at: or at:put:)
        //then return the info in nonCachedInfo.
        //Note that info for objectAt (includeInstVars) will have
        //a zero ivarOffset, and a size that includes the extra instVars
        var info;
        var cacheable =
            (this.vm.verifyAtSelector === atOrPutSelector)         //is at or atPut
            && (this.vm.verifyAtClass === array.sqClass)           //not a super send
            && !this.vm.isContext(array);                          //not a context (size can change)
        info = cacheable ? atOrPutCache[array.hash & this.atCacheMask] : this.nonCachedInfo;
        info.array = array;
        info.convertChars = convertChars;
        if (includeInstVars) {
            info.size = array.instSize() + Math.max(0, array.indexableSize(this));
            info.ivarOffset = 0;
        } else {
            info.size = array.indexableSize(this);
            info.ivarOffset = array.isPointers() ? array.instSize() : 0;
        }
        return info;
    },
},
'basic',{
    instantiateClass: function(clsObj, indexableSize) {
        if (indexableSize * 4 > this.vm.image.bytesLeft()) {
            // we're not really out of memory, we have no idea how much memory is available
            // but we need to stop runaway allocations
            console.warn("squeak: out of memory");
            this.success = false;
            this.vm.primFailCode = Squeak.PrimErrNoMemory;
            return null;
        } else {
            return this.vm.instantiateClass(clsObj, indexableSize);
        }
    },
    someObject: function() {
        return this.vm.image.firstOldObject;
    },
    nextObject: function(obj) {
        return this.vm.image.objectAfter(obj) || 0;
    },
    someInstanceOf: function(clsObj) {
        var someInstance = this.vm.image.someInstanceOf(clsObj);
        if (someInstance) return someInstance;
        this.success = false;
        return 0;
    },
    nextInstanceAfter: function(obj) {
        var nextInstance = this.vm.image.nextInstanceAfter(obj);
        if (nextInstance) return nextInstance;
        this.success = false;
        return 0;
    },
    allInstancesOf: function(clsObj) {
        var instances = this.vm.image.allInstancesOf(clsObj);
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], instances.length);
        array.pointers = instances;
        return array;
    },
    identityHash: function(obj) {
        return obj.hash;
    },
    identityHashSpur: function(obj) {
        var hash = obj.hash;
        if (hash > 0) return hash;
        return obj.hash = this.newObjectHash();
    },
    behaviorHash: function(obj) {
        var hash = obj.hash;
        if (hash > 0) return hash;
        return this.vm.image.enterIntoClassTable(obj);
    },
    newObjectHash: function(obj) {
        return Math.floor(Math.random() * 0x3FFFFE) + 1;
    },
    primitiveSizeInBytesOfInstance: function(argCount) {
        if (argCount > 1) return false;
        var classObj = this.stackNonInteger(argCount),
            nElements = argCount ? this.stackInteger(0) : 0,
            bytes = classObj.classByteSizeOfInstance(nElements);
        return this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(bytes));
    },
    primitiveSizeInBytes: function(argCount) {
        var object = this.stackNonInteger(0),
            bytes = object.totalBytes();
        return this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(bytes));
    },
    primitiveAsCharacter: function(argCount) {
        var unicode = this.stackInteger(0);
        if (unicode < 0 || unicode > 0x3FFFFFFF) return false;
        var char = this.charFromInt(unicode);
        if (!char) return false;
        return this.popNandPushIfOK(argCount + 1, char);
    },
    primitiveFullGC: function(argCount) {
        this.vm.image.fullGC("primitive");
        var bytes = this.vm.image.bytesLeft();
        return this.popNandPushIfOK(1, this.makeLargeIfNeeded(bytes));
    },
    primitivePartialGC: function(argCount) {
        this.vm.image.partialGC("primitive");
        var bytes = this.vm.image.bytesLeft();
        return this.popNandPushIfOK(1, this.makeLargeIfNeeded(bytes));
    },
    primitiveMakePoint: function(argCount, checkNumbers) {
        var x = this.vm.stackValue(1);
        var y = this.vm.stackValue(0);
        if (checkNumbers) {
            this.checkFloat(x);
            this.checkFloat(y);
            if (!this.success) return false;
        }
        this.vm.popNandPush(1+argCount, this.makePointWithXandY(x, y));
        return true;
    },
    primitiveStoreStackp: function(argCount) {
        var ctxt = this.stackNonInteger(1),
            newStackp = this.stackInteger(0);
        if (!this.success || newStackp < 0 || this.vm.decodeSqueakSP(newStackp) >= ctxt.pointers.length)
            return false;
        var stackp = ctxt.pointers[Squeak.Context_stackPointer];
        while (stackp < newStackp)
            ctxt.pointers[this.vm.decodeSqueakSP(++stackp)] = this.vm.nilObj;
        ctxt.pointers[Squeak.Context_stackPointer] = newStackp;
        this.vm.popN(argCount);
        return true;
    },
    primitiveChangeClass: function(argCount) {
        if (argCount > 2) return false;
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0);
        if (!this.changeClassTo(rcvr, arg.sqClass)) {
            return false;
        }
        return this.popNIfOK(argCount);
    },
    primitiveAdoptInstance: function(argCount) {
        if (argCount > 2) return false;
        var cls = this.stackNonInteger(1),
            obj = this.stackNonInteger(0);
        if (!this.changeClassTo(obj, cls)) {
            return false;
        }
        return this.popNIfOK(argCount);
    },
    changeClassTo: function(rcvr, cls) {
        if (rcvr.sqClass.isCompact !== cls.isCompact) return false;
        var classInstIsPointers = cls.classInstIsPointers();
        if (rcvr.isPointers()) {
            if (!classInstIsPointers) return false;
            if (rcvr.sqClass.classInstSize() !== cls.classInstSize())
                return false;
        } else {
            if (classInstIsPointers) return false;
            var hasBytes = rcvr.isBytes(),
                needBytes = cls.classInstIsBytes();
            if (hasBytes && !needBytes) {
                if (rcvr.bytes) {
                    if (rcvr.bytes.length & 3) return false;
                    rcvr.words = new Uint32Array(rcvr.bytes.buffer);
                    delete rcvr.bytes;
                }
            } else if (!hasBytes && needBytes) {
                if (rcvr.words) {
                    rcvr.bytes = new Uint8Array(rcvr.words.buffer);
                    delete rcvr.words;
                }
            }
        }
        rcvr._format = cls.classInstFormat();
        rcvr.sqClass = cls;
        return true;
    },
    primitiveDoPrimitiveWithArgs: function(argCount) {
        var argumentArray = this.stackNonInteger(0),
            primIdx = this.stackInteger(1);
        if (!this.success) return false;
        var arraySize = argumentArray.pointersSize(),
            cntxSize = this.vm.activeContext.pointersSize();
        if (this.vm.sp + arraySize >= cntxSize) return false;
        // Pop primIndex and argArray, then push args in place...
        this.vm.popN(2);
        for (var i = 0; i < arraySize; i++)
            this.vm.push(argumentArray.pointers[i]);
        // Run the primitive
        if (this.vm.tryPrimitive(primIdx, arraySize))
            return true;
        // Primitive failed, restore state for failure code
        this.vm.popN(arraySize);
        this.vm.push(primIdx);
        this.vm.push(argumentArray);
        return false;
    },
    primitiveShortAtAndPut: function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt16Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // shortAt:
            value = array[index];
        } else { // shortAt:put:
            value = this.stackInteger(0);
            if (value < -32768 || value > 32767)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveIntegerAtAndPut:  function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt32Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // integerAt:
            value = this.signed32BitIntegerFor(array[index]);
        } else { // integerAt:put:
            value = this.stackSigned32BitInt(0);
            if (!this.success)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveConstantFill:  function(argCount) {
        var rcvr = this.stackNonInteger(1),
            value = this.stackPos32BitInt(0);
        if (!this.success || !rcvr.isWordsOrBytes())
            return false;
        var array = rcvr.words || rcvr.bytes;
        if (array) {
            if (array === rcvr.bytes && value > 255)
                return false;
            for (var i = 0; i < array.length; i++)
                array[i] = value;
        }
        this.vm.popN(argCount);
        return true;
    },
    primitiveNewMethod: function(argCount) {
        var header = this.stackInteger(0);
        var bytecodeCount = this.stackInteger(1);
        if (!this.success) return 0;
        var method = this.vm.instantiateClass(this.vm.stackValue(2), bytecodeCount);
        method.pointers = [header];
        var litCount = method.methodNumLits();
        for (var i = 0; i < litCount; i++)
            method.pointers.push(this.vm.nilObj);
        this.vm.popNandPush(1+argCount, method);
        if (this.vm.breakOnNewMethod)               // break on doit
            this.vm.breakOnMethod = method;
        return true;
    },
    primitiveExecuteMethodArgsArray: function(argCount) {
        // receiver, argsArray, then method are on top of stack.  Execute method with
        // receiver and args.
        var methodObj = this.stackNonInteger(0),
            argsArray = this.stackNonInteger(1),
            receiver = this.vm.stackValue(2);
        // Allow for up to two extra arguments (e.g. for mirror primitives).
        if (!this.success || !methodObj.isMethod() || argCount > 4) return false;
        var numArgs = methodObj.methodNumArgs();
        if (numArgs !== argsArray.pointersSize()) return false;
        // drop all args, push receiver, and new arguments
        this.vm.popNandPush(argCount+1, receiver);
        for (var i = 0; i < numArgs; i++)
            this.vm.push(argsArray.pointers[i]);
        this.vm.executeNewMethod(receiver, methodObj, numArgs, methodObj.methodPrimitiveIndex(), null, null);
        return true;
    },
    primitiveArrayBecome: function(argCount, doBothWays, copyHash) {
        var rcvr = this.stackNonInteger(argCount),
            arg = this.stackNonInteger(argCount-1);
        if (argCount > 1) copyHash = this.stackBoolean(argCount-2);
        if (!this.success) return false;
        this.success = this.vm.image.bulkBecome(rcvr.pointers, arg.pointers, doBothWays, copyHash);
        return this.popNIfOK(argCount);
    },
    doStringReplace: function() {
        var dst = this.stackNonInteger(4);
        var dstPos = this.stackInteger(3) - 1;
        var count = this.stackInteger(2) - dstPos;
        var src = this.stackNonInteger(1);
        var srcPos = this.stackInteger(0) - 1;
        if (!this.success) return dst; //some integer not right
        if (!src.sameFormatAs(dst)) {this.success = false; return dst;} //incompatible formats
        if (src.isPointers()) {//pointer type objects
            var totalLength = src.pointersSize();
            var srcInstSize = src.instSize();
            srcPos += srcInstSize;
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.pointersSize();
            var dstInstSize= dst.instSize();
            dstPos += dstInstSize;
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success= false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.pointers[dstPos + i] = src.pointers[srcPos + i];
            return dst;
        } else if (src.isWords()) { //words type objects
            var totalLength = src.wordsSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.wordsSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            if (src.isFloat && dst.isFloat)
                dst.float = src.float;
            else if (src.isFloat)
                dst.wordsAsFloat64Array()[dstPos] = src.float;
            else if (dst.isFloat)
                dst.float = src.wordsAsFloat64Array()[srcPos];
            else for (var i = 0; i < count; i++)
                dst.words[dstPos + i] = src.words[srcPos + i];
            return dst;
        } else { //bytes type objects
            var totalLength = src.bytesSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.bytesSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.bytes[dstPos + i] = src.bytes[srcPos + i];
            return dst;
        }
    },
    primitiveCopyObject: function(argCount) {
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0),
            length = rcvr.pointersSize();
        if (!this.success ||
            rcvr.isWordsOrBytes() ||
            rcvr.sqClass !== arg.sqClass ||
            length !== arg.pointersSize()) return false;
        for (var i = 0; i < length; i++)
            rcvr.pointers[i] = arg.pointers[i];
        rcvr.dirty = arg.dirty;
        this.vm.popN(argCount);
        return true;
    },
    primitiveLoadImageSegment: function(argCount) {
        var segmentWordArray = this.stackNonInteger(1),
            outPointerArray = this.stackNonInteger(0);
        if (!segmentWordArray.words || !outPointerArray.pointers) return false;
        var roots = this.vm.image.loadImageSegment(segmentWordArray, outPointerArray);
        if (!roots) return false;
        return this.popNandPushIfOK(argCount + 1, roots);
    },
},
'blocks/closures', {
    doBlockCopy: function() {
        var rcvr = this.vm.stackValue(1);
        var sqArgCount = this.stackInteger(0);
        var homeCtxt = rcvr;
        if(!this.vm.isContext(homeCtxt)) this.success = false;
        if(!this.success) return rcvr;
        if (typeof homeCtxt.pointers[Squeak.Context_method] === "number")
            // ctxt is itself a block; get the context for its enclosing method
            homeCtxt = homeCtxt.pointers[Squeak.BlockContext_home];
        var blockSize = homeCtxt.pointersSize() - homeCtxt.instSize(); // could use a const for instSize
        var newBlock = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassBlockContext], blockSize);
        var initialPC = this.vm.encodeSqueakPC(this.vm.pc + 2, this.vm.method); //*** check this...
        newBlock.pointers[Squeak.BlockContext_initialIP] = initialPC;
        newBlock.pointers[Squeak.Context_instructionPointer] = initialPC; // claim not needed; value will set it
        newBlock.pointers[Squeak.Context_stackPointer] = 0;
        newBlock.pointers[Squeak.BlockContext_argumentCount] = sqArgCount;
        newBlock.pointers[Squeak.BlockContext_home] = homeCtxt;
        newBlock.pointers[Squeak.Context_sender] = this.vm.nilObj; // claim not needed; just initialized
        return newBlock;
    },
    primitiveBlockValue: function(argCount) {
        var rcvr = this.vm.stackValue(argCount);
        if (!this.isA(rcvr, Squeak.splOb_ClassBlockContext)) return false;
        var block = rcvr;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != argCount) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(this.vm.activeContext.pointers, this.vm.sp-argCount+1, block.pointers, Squeak.Context_tempFrameStart, argCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = argCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContext;
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveBlockValueWithArgs: function(argCount) {
        var block = this.vm.stackValue(1);
        var array = this.vm.stackValue(0);
        if (!this.isA(block, Squeak.splOb_ClassBlockContext)) return false;
        if (!this.isA(array, Squeak.splOb_ClassArray)) return false;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != array.pointersSize()) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(array.pointers, 0, block.pointers, Squeak.Context_tempFrameStart, blockArgCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = blockArgCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContext;
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveClosureCopyWithCopiedValues: function(argCount) {
        this.vm.breakNow("primitiveClosureCopyWithCopiedValues");
        debugger;
        return false;
    },
    primitiveClosureValue: function(argCount) {
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewClosureMethod(blockClosure, argCount);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveClosureValueWithArgs: function(argCount) {
        var array = this.vm.top(),
            arraySize = array.pointersSize(),
            blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (arraySize !== blockArgCount) return false;
        this.vm.pop();
        for (var i = 0; i < arraySize; i++)
            this.vm.push(array.pointers[i]);
        this.activateNewClosureMethod(blockClosure, arraySize);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveClosureValueNoContextSwitch: function(argCount) {
        // An exact clone of primitiveClosureValue except that this version will not check for interrupts
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewClosureMethod(blockClosure, argCount);
        return true;
    },
    primitiveFullClosureValue: function(argCount) {
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewFullClosure(blockClosure, argCount);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveFullClosureValueWithArgs: function(argCount) {
        var array = this.vm.top(),
            arraySize = array.pointersSize(),
            blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (arraySize !== blockArgCount) return false;
        this.vm.pop();
        for (var i = 0; i < arraySize; i++)
            this.vm.push(array.pointers[i]);
        this.activateNewFullClosure(blockClosure, arraySize);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveFullClosureValueNoContextSwitch: function(argCount) {
        // An exact clone of primitiveFullClosureValue except that this version will not check for interrupts
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewFullClosure(blockClosure, argCount);
        return true;
    },
    activateNewClosureMethod: function(blockClosure, argCount) {
        var outerContext = blockClosure.pointers[Squeak.Closure_outerContext],
            method = outerContext.pointers[Squeak.Context_method],
            newContext = this.vm.allocateOrRecycleContext(method.methodNeedsLargeFrame()),
            numCopied = blockClosure.pointers.length - Squeak.Closure_firstCopiedValue;
        newContext.pointers[Squeak.Context_sender] = this.vm.activeContext;
        newContext.pointers[Squeak.Context_instructionPointer] = blockClosure.pointers[Squeak.Closure_startpc];
        newContext.pointers[Squeak.Context_stackPointer] = argCount + numCopied;
        newContext.pointers[Squeak.Context_method] = outerContext.pointers[Squeak.Context_method];
        newContext.pointers[Squeak.Context_closure] = blockClosure;
        newContext.pointers[Squeak.Context_receiver] = outerContext.pointers[Squeak.Context_receiver];
        // Copy the arguments and copied values ...
        var where = Squeak.Context_tempFrameStart;
        for (var i = 0; i < argCount; i++)
            newContext.pointers[where++] = this.vm.stackValue(argCount - i - 1);
        for (var i = 0; i < numCopied; i++)
            newContext.pointers[where++] = blockClosure.pointers[Squeak.Closure_firstCopiedValue + i];
        // The initial instructions in the block nil-out remaining temps.
        this.vm.popN(argCount + 1);
        this.vm.newActiveContext(newContext);
    },
    activateNewFullClosure: function(blockClosure, argCount) {
        var closureMethod = blockClosure.pointers[Squeak.ClosureFull_method],
            newContext = this.vm.allocateOrRecycleContext(closureMethod.methodNeedsLargeFrame()),
            numCopied = blockClosure.pointers.length - Squeak.ClosureFull_firstCopiedValue;
        newContext.pointers[Squeak.Context_sender] = this.vm.activeContext;
        newContext.pointers[Squeak.Context_instructionPointer] = this.vm.encodeSqueakPC(0, closureMethod);
        newContext.pointers[Squeak.Context_stackPointer] = closureMethod.methodTempCount(); // argCount + numCopied + numActualTemps
        newContext.pointers[Squeak.Context_method] = closureMethod;
        newContext.pointers[Squeak.Context_closure] = blockClosure;
        newContext.pointers[Squeak.Context_receiver] = blockClosure.pointers[Squeak.ClosureFull_receiver];
        // Copy the arguments and copied values ...
        var where = Squeak.Context_tempFrameStart;
        for (var i = 0; i < argCount; i++)
            newContext.pointers[where++] = this.vm.stackValue(argCount - i - 1);
        for (var i = 0; i < numCopied; i++)
            newContext.pointers[where++] = blockClosure.pointers[Squeak.ClosureFull_firstCopiedValue + i];
        // No need to nil-out remaining temps as context pointers are nil-initialized.
        this.vm.popN(argCount + 1);
        this.vm.newActiveContext(newContext);
    },
},
'scheduling', {
    primitiveResume: function() {
        this.resume(this.vm.top());
        return true;
    },
    primitiveSuspend: function() {
        var process = this.vm.top();
        if (process === this.activeProcess()) {
            this.vm.popNandPush(1, this.vm.nilObj);
            this.transferTo(this.wakeHighestPriority());
        } else {
            var oldList = process.pointers[Squeak.Proc_myList];
            if (oldList.isNil) return false;
            this.removeProcessFromList(process, oldList);
            if (!this.success) return false;
            process.pointers[Squeak.Proc_myList] = this.vm.nilObj;
            this.vm.popNandPush(1, oldList);
        }
        return true;
    },
    getScheduler: function() {
        var assn = this.vm.specialObjects[Squeak.splOb_SchedulerAssociation];
        return assn.pointers[Squeak.Assn_value];
    },
    activeProcess: function() {
        return this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
    },
    resume: function(newProc) {
        var activeProc = this.activeProcess();
        var activePriority = activeProc.pointers[Squeak.Proc_priority];
        var newPriority = newProc.pointers[Squeak.Proc_priority];
        if (newPriority > activePriority) {
            this.putToSleep(activeProc);
            this.transferTo(newProc);
        } else {
            this.putToSleep(newProc);
        }
    },
    putToSleep: function(aProcess) {
        //Save the given process on the scheduler process list for its priority.
        var priority = aProcess.pointers[Squeak.Proc_priority];
        var processLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var processList = processLists.pointers[priority - 1];
        this.linkProcessToList(aProcess, processList);
    },
    transferTo: function(newProc) {
        //Record a process to be awakened on the next interpreter cycle.
        var sched = this.getScheduler();
        var oldProc = sched.pointers[Squeak.ProcSched_activeProcess];
        sched.pointers[Squeak.ProcSched_activeProcess] = newProc;
        sched.dirty = true;
        oldProc.pointers[Squeak.Proc_suspendedContext] = this.vm.activeContext;
        oldProc.dirty = true;
        this.vm.newActiveContext(newProc.pointers[Squeak.Proc_suspendedContext]);
        newProc.pointers[Squeak.Proc_suspendedContext] = this.vm.nilObj;
        this.vm.reclaimableContextCount = 0;
        if (this.vm.breakOnContextChanged) {
            this.vm.breakOnContextChanged = false;
            this.vm.breakNow();
        }
    },
    wakeHighestPriority: function() {
        //Return the highest priority process that is ready to run.
        //Note: It is a fatal VM error if there is no runnable process.
        var schedLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var p = schedLists.pointersSize() - 1;  // index of last indexable field
        var processList;
        do {
            if (p < 0) throw Error("scheduler could not find a runnable process");
            processList = schedLists.pointers[p--];
        } while (this.isEmptyList(processList));
        return this.removeFirstLinkOfList(processList);
    },
    linkProcessToList: function(proc, aList) {
        // Add the given process to the given linked list and set the backpointer
        // of process to its new list.
        if (this.isEmptyList(aList)) {
            aList.pointers[Squeak.LinkedList_firstLink] = proc;
        } else {
            var lastLink = aList.pointers[Squeak.LinkedList_lastLink];
            lastLink.pointers[Squeak.Link_nextLink] = proc;
            lastLink.dirty = true;
        }
        aList.pointers[Squeak.LinkedList_lastLink] = proc;
        aList.dirty = true;
        proc.pointers[Squeak.Proc_myList] = aList;
        proc.dirty = true;
    },
    isEmptyList: function(aLinkedList) {
        return aLinkedList.pointers[Squeak.LinkedList_firstLink].isNil;
    },
    removeFirstLinkOfList: function(aList) {
        //Remove the first process from the given linked list.
        var first = aList.pointers[Squeak.LinkedList_firstLink];
        var last = aList.pointers[Squeak.LinkedList_lastLink];
        if (first === last) {
            aList.pointers[Squeak.LinkedList_firstLink] = this.vm.nilObj;
            aList.pointers[Squeak.LinkedList_lastLink] = this.vm.nilObj;
        } else {
            var next = first.pointers[Squeak.Link_nextLink];
            aList.pointers[Squeak.LinkedList_firstLink] = next;
            aList.dirty = true;
        }
        first.pointers[Squeak.Link_nextLink] = this.vm.nilObj;
        return first;
    },
    removeProcessFromList: function(process, list) {
        var first = list.pointers[Squeak.LinkedList_firstLink];
        var last = list.pointers[Squeak.LinkedList_lastLink];
        if (process === first) {
            var next = process.pointers[Squeak.Link_nextLink];
            list.pointers[Squeak.LinkedList_firstLink] = next;
            if (process === last) {
                list.pointers[Squeak.LinkedList_lastLink] = this.vm.nilObj;
            }
        } else {
            var temp = first;
            while (true) {
                if (temp.isNil) return this.success = false;
                next = temp.pointers[Squeak.Link_nextLink];
                if (next === process) break;
                temp = next;
            }
            next = process.pointers[Squeak.Link_nextLink];
            temp.pointers[Squeak.Link_nextLink] = next;
            if (process === last) {
                list.pointers[Squeak.LinkedList_lastLink] = temp;
            }
        }
        process.pointers[Squeak.Link_nextLink] = this.vm.nilObj;
    },
    registerSemaphore: function(specialObjIndex) {
        var sema = this.vm.top();
        if (this.isA(sema, Squeak.splOb_ClassSemaphore))
            this.vm.specialObjects[specialObjIndex] = sema;
        else
            this.vm.specialObjects[specialObjIndex] = this.vm.nilObj;
        return this.vm.stackValue(1);
    },
    primitiveWait: function() {
        var sema = this.vm.top();
        if (!this.isA(sema, Squeak.splOb_ClassSemaphore)) return false;
        var excessSignals = sema.pointers[Squeak.Semaphore_excessSignals];
        if (excessSignals > 0)
            sema.pointers[Squeak.Semaphore_excessSignals] = excessSignals - 1;
        else {
            this.linkProcessToList(this.activeProcess(), sema);
            this.transferTo(this.wakeHighestPriority());
        }
        return true;
    },
    primitiveSignal: function() {
        var sema = this.vm.top();
        if (!this.isA(sema, Squeak.splOb_ClassSemaphore)) return false;
        this.synchronousSignal(sema);
        return true;
    },
    synchronousSignal: function(sema) {
        if (this.isEmptyList(sema)) {
            // no process is waiting on this semaphore
            sema.pointers[Squeak.Semaphore_excessSignals]++;
        } else
            this.resume(this.removeFirstLinkOfList(sema));
        return;
    },
    signalAtMilliseconds: function(sema, msTime) {
        if (this.isA(sema, Squeak.splOb_ClassSemaphore)) {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = sema;
            this.vm.nextWakeupTick = msTime;
        } else {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = this.vm.nilObj;
            this.vm.nextWakeupTick = 0;
        }
    },
    primitiveSignalAtMilliseconds: function(argCount) {
        var msTime = this.stackInteger(0);
        var sema = this.stackNonInteger(1);
        if (!this.success) return false;
        this.signalAtMilliseconds(sema, msTime);
        this.vm.popN(argCount); // return self
        return true;
    },
    primitiveSignalAtUTCMicroseconds: function(argCount) {
        var usecsUTC = this.stackSigned53BitInt(0);
        var sema = this.stackNonInteger(1);
        if (!this.success) return false;
        var msTime = (usecsUTC / 1000 + Squeak.EpochUTC - this.vm.startupTime) & Squeak.MillisecondClockMask;
        this.signalAtMilliseconds(sema, msTime);
        this.vm.popN(argCount); // return self
        return true;
    },
    signalSemaphoreWithIndex: function(semaIndex) {
        // asynch signal: will actually be signaled in checkForInterrupts()
        this.semaphoresToSignal.push(semaIndex);
    },
    signalExternalSemaphores: function() {
        var semaphores = this.vm.specialObjects[Squeak.splOb_ExternalObjectsArray].pointers,
            semaClass = this.vm.specialObjects[Squeak.splOb_ClassSemaphore];
        while (this.semaphoresToSignal.length) {
            var semaIndex = this.semaphoresToSignal.shift(),
                sema = semaphores[semaIndex - 1];
            if (sema.sqClass == semaClass)
                this.synchronousSignal(sema);
        }
    },
    primitiveEnterCriticalSection: function(argCount) {
        if (argCount > 1) return false;
        var mutex = this.vm.stackValue(argCount);
        var activeProc = argCount ? this.vm.top() : this.activeProcess();
        var owningProcess = mutex.pointers[Squeak.Mutex_owner];
        if (owningProcess.isNil) {
            mutex.pointers[Squeak.Mutex_owner] = activeProc;
            mutex.dirty = true;
            this.popNandPushIfOK(argCount + 1, this.vm.falseObj);
        } else if (owningProcess === activeProc) {
            this.popNandPushIfOK(argCount + 1, this.vm.trueObj);
        } else {
            this.popNandPushIfOK(argCount + 1, this.vm.falseObj);
            this.linkProcessToList(activeProc, mutex);
            this.transferTo(this.wakeHighestPriority());
        }
        return true;
    },
    primitiveExitCriticalSection: function(argCount) {
        var criticalSection = this.vm.top();
        if (this.isEmptyList(criticalSection)) {
            criticalSection.pointers[Squeak.Mutex_owner] = this.vm.nilObj;
        } else {
            var owningProcess = this.removeFirstLinkOfList(criticalSection);
            criticalSection.pointers[Squeak.Mutex_owner] = owningProcess;
            criticalSection.dirty = true;
            this.resume(owningProcess);
        }
        return true;
    },
    primitiveTestAndSetOwnershipOfCriticalSection: function(argCount) {
        if (argCount > 1) return false;
        var mutex = this.vm.stackValue(argCount);
        var activeProc = argCount ? this.vm.top() : this.activeProcess();
        var owningProcess = mutex.pointers[Squeak.Mutex_owner];
        if (owningProcess.isNil) {
            mutex.pointers[Squeak.Mutex_owner] = activeProc;
            mutex.dirty = true;
            this.popNandPushIfOK(argCount + 1, this.vm.falseObj);
        } else if (owningProcess === activeProc) {
            this.popNandPushIfOK(argCount + 1, this.vm.trueObj);
        } else {
            this.popNandPushIfOK(argCount + 1, this.vm.nilObj);
        }
        return true;
    },
},
'vm functions', {
    primitiveGetAttribute: function(argCount) {
        var attr = this.stackInteger(0);
        if (!this.success) return false;
        var argv = this.display.argv,
            vmOptions = this.display.vmOptions,
            value = null;
        switch (attr) {
            case 0: value = (argv && argv[0]) || this.filenameToSqueak(Squeak.vmPath + Squeak.vmFile); break;
            case 1: value = (argv && argv[1]) || this.display.documentName; break; // 1.x images want document here
            case 2: value = (argv && argv[2]) || this.display.documentName; break; // later images want document here
            case 1001: value = Squeak.platformName; break;
            case 1002: value = Squeak.osVersion; break;
            case 1003: value = Squeak.platformSubtype; break;
            case 1004: value = Squeak.vmVersion + ' ' + Squeak.vmMakerVersion; break;
            case 1005: value = Squeak.windowSystem; break;
            case 1006: value = Squeak.vmBuild; break;
            case 1007: value = Squeak.vmVersion; break; // Interpreter class
            // case 1008: Cogit class
            case 1009: value = Squeak.vmVersion + ' Date: ' + Squeak.vmDate; break; // Platform source version
            default:
                if (attr >= 0 && argv && argv.length > attr) {
                    value = argv[attr];
                } else if (attr < 0 && vmOptions && vmOptions.length > -attr - 1) {
                    value = vmOptions[-attr - 1];
                } else {
                    return false;
                }
        }
        this.vm.popNandPush(argCount+1, this.makeStObject(value));
        return true;
    },
    setLowSpaceThreshold: function() {
        var nBytes = this.stackInteger(0);
        if (this.success) this.vm.lowSpaceThreshold = nBytes;
        return this.vm.stackValue(1);
    },
    primitiveVMParameter: function(argCount) {
        /* Behaviour depends on argument count:
        0 args: return an Array of VM parameter values;
        1 arg:  return the indicated VM parameter;
        2 args: set the VM indicated parameter. */
        var paramsArraySize = this.vm.image.isSpur ? 71 : 44;
        switch (argCount) {
            case 0:
                var arrayObj = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], paramsArraySize);
                for (var i = 0; i < paramsArraySize; i++)
                    arrayObj.pointers[i] = this.makeStObject(this.vmParameterAt(i+1));
                return this.popNandPushIfOK(1, arrayObj);
            case 1:
                var parm = this.stackInteger(0);
                if (parm < 1 || parm > paramsArraySize) return false;
                return this.popNandPushIfOK(2, this.makeStObject(this.vmParameterAt(parm)));
            case 2:
                // ignore writes
                return this.popNandPushIfOK(3, 0);
        };
        return false;
    },
    vmParameterAt: function(index) {
        switch (index) {
            case 1: return this.vm.image.oldSpaceBytes;     // end of old-space (0-based, read-only)
            case 2: return this.vm.image.oldSpaceBytes;     // end of young-space (read-only)
            case 3: return this.vm.image.totalMemory;       // end of memory (read-only)
            case 4: return this.vm.image.allocationCount + this.vm.image.newSpaceCount; // allocationCount (read-only; nil in Cog VMs)
            // 5    allocations between GCs (read-write; nil in Cog VMs)
            // 6    survivor count tenuring threshold (read-write)
            case 7: return this.vm.image.gcCount;           // full GCs since startup (read-only)
            case 8: return this.vm.image.gcMilliseconds;    // total milliseconds in full GCs since startup (read-only)
            case 9: return this.vm.image.pgcCount;          // incremental GCs since startup (read-only)
            case 10: return this.vm.image.pgcMilliseconds;  // total milliseconds in incremental GCs since startup (read-only)
            case 11: return this.vm.image.gcTenured;        // tenures of surving objects since startup (read-only)
            // 12-20 specific to the translating VM
            case 15:
            case 16:                                        // idle microseconds
            case 17:
            case 18:
            case 19:
            case 20: return 0;                              // utc microseconds at VM start-up
            // 21   root table size (read-only)
            case 22: return 0;                              // root table overflows since startup (read-only)
            case 23: return this.vm.image.extraVMMemory;    // bytes of extra memory to reserve for VM buffers, plugins, etc.
            // 24   memory threshold above which to shrink object memory (read-write)
            // 25   memory headroom when growing object memory (read-write)
            // 26   interruptChecksEveryNms - force an ioProcessEvents every N milliseconds (read-write)
            // 27   number of times mark loop iterated for current IGC/FGC (read-only) includes ALL marking
            // 28   number of times sweep loop iterated for current IGC/FGC (read-only)
            // 29   number of times make forward loop iterated for current IGC/FGC (read-only)
            // 30   number of times compact move loop iterated for current IGC/FGC (read-only)
            // 31   number of grow memory requests (read-only)
            // 32   number of shrink memory requests (read-only)
            // 33   number of root table entries used for current IGC/FGC (read-only)
            // 34   number of allocations done before current IGC/FGC (read-only)
            // 35   number of survivor objects after current IGC/FGC (read-only)
            // 36   millisecond clock when current IGC/FGC completed (read-only)
            // 37   number of marked objects for Roots of the world, not including Root Table entries for current IGC/FGC (read-only)
            // 38   milliseconds taken by current IGC (read-only)
            // 39   Number of finalization signals for Weak Objects pending when current IGC/FGC completed (read-only)
            case 40: return 4; // BytesPerWord for this image
            case 41: return this.vm.image.formatVersion();
            //42    number of stack pages in use (Cog Stack VM only, otherwise nil)
            //43    desired number of stack pages (stored in image file header, max 65535; Cog VMs only, otherwise nil)
            case 44: return 0; // size of eden, in bytes
            // 45   desired size of eden, in bytes (stored in image file header; Cog VMs only, otherwise nil)
            // 46   size of machine code zone, in bytes (stored in image file header; Cog JIT VM only, otherwise nil)
            case 46: return 0;
            // 47   desired size of machine code zone, in bytes (applies at startup only, stored in image file header; Cog JIT VM only)
            case 48: return 0;
            // 48   various properties of the Cog VM as an integer encoding an array of bit flags.
            //      Bit 0: tells the VM that the image's Process class has threadId as its 5th inst var (after nextLink, suspendedContext, priority & myList)
            //      Bit 1: on Cog JIT VMs asks the VM to set the flag bit in interpreted methods
            //      Bit 2: if set, preempting a process puts it to the head of its run queue, not the back,
            //             i.e. preempting a process by a higher priority one will not cause the preempted process to yield
            //             to others at the same priority.
            //      Bit 3: in a muilt-threaded VM, if set, the Window system will only be accessed from the first VM thread
            //      Bit 4: in a Spur vm, if set, causes weaklings and ephemerons to be queued individually for finalization
            // 49   the size of the external semaphore table (read-write; Cog VMs only)
            // 50-51 reserved for VM parameters that persist in the image (such as eden above)
            // 52   root (remembered) table maximum size (read-only)
            // 53   the number of oldSpace segments (Spur only, otherwise nil)
            case 54: return this.vm.image.bytesLeft();  // total size of free old space (Spur only, otherwise nil)
            // 55   ratio of growth and image size at or above which a GC will be performed post scavenge (Spur only, otherwise nil)
            // 56   number of process switches since startup (read-only)
            // 57   number of ioProcessEvents calls since startup (read-only)
            // 58   number of forceInterruptCheck (Cog VMs) or quickCheckInterruptCalls (non-Cog VMs) calls since startup (read-only)
            // 59   number of check event calls since startup (read-only)
            // 60   number of stack page overflows since startup (read-only; Cog VMs only)
            // 61   number of stack page divorces since startup (read-only; Cog VMs only)
            // 62   number of machine code zone compactions since startup (read-only; Cog VMs only)
            // 63   milliseconds taken by machine code zone compactions since startup (read-only; Cog VMs only)
            // 64   current number of machine code methods (read-only; Cog VMs only)
            // 65   In newer Cog VMs a set of flags describing VM features,
            //      if non-zero bit 0 implies multiple bytecode set support;
            //      if non-zero bit 0 implies read-only object support
            //      (read-only; Cog VMs only; nil in older Cog VMs, a boolean answering multiple bytecode support in not so old Cog VMs)
            case 65: return 0;
            // 66   the byte size of a stack page in the stack zone  (read-only; Cog VMs only)
            // 67   the maximum allowed size of old space in bytes, 0 implies no internal limit (Spur VMs only).
            // 68 - 69 reserved for more Cog-related info
            // 70   the value of VM_PROXY_MAJOR (the interpreterProxy major version number)
            // 71   the value of VM_PROXY_MINOR (the interpreterProxy minor version number)"
        }
        return null;
    },
    primitiveImageName: function(argCount) {
        if (argCount == 0)
            return this.popNandPushIfOK(1, this.makeStString(this.filenameToSqueak(this.vm.image.name)));
        this.vm.image.name = this.filenameFromSqueak(this.vm.top().bytesAsString());
        Squeak.Settings['squeakImageName'] = this.vm.image.name;
        return true;
    },
    primitiveSnapshot: function(argCount) {
        this.vm.popNandPush(1, this.vm.trueObj);        // put true on stack for saved snapshot
        this.vm.storeContextRegisters();                // store current state for snapshot
        this.activeProcess().pointers[Squeak.Proc_suspendedContext] = this.vm.activeContext; // store initial context
        this.vm.image.fullGC("snapshot");               // before cleanup so traversal works
        var buffer = this.vm.image.writeToBuffer();
        // Write snapshot if files are supported
        if(Squeak.flushAllFiles) {
            Squeak.flushAllFiles();                         // so there are no more writes pending
            Squeak.filePut(this.vm.image.name, buffer);
        }
        this.vm.popNandPush(1, this.vm.falseObj);       // put false on stack for continuing
        return true;
    },
    primitiveQuit: function(argCount) {
        // Flush any files if files are supported
        if(Squeak.flushAllFiles)
            Squeak.flushAllFiles();
        this.display.quitFlag = true;
        this.vm.breakNow("quit");
        return true;
    },
    primitiveExitToDebugger: function(argCount) {
        this.vm.breakNow("debugger primitive");
        //console.error(this.vm.printStack(null));
        debugger;
        return true;
    },
    primitiveSetGCBiasToGrow: function(argCount) {
        return this.fakePrimitive(".primitiveSetGCBiasToGrow", 0, argCount);
    },
    primitiveSetGCBiasToGrowGCLimit: function(argCount) {
        return this.fakePrimitive(".primitiveSetGCBiasToGrowGCLimit", 0, argCount);
    },
},
'time', {
    primitiveRelinquishProcessorForMicroseconds: function(argCount) {
        // we ignore the optional arg
        this.vm.popN(argCount);
        this.vm.goIdle();        // might switch process, so must be after pop
        return true;
    },
    millisecondClockValue: function() {
        //Return the value of the millisecond clock as an integer.
        //Note that the millisecond clock wraps around periodically.
        //The range is limited to SmallInteger maxVal / 2 to allow
        //delays of up to that length without overflowing a SmallInteger.
        return (Date.now() - this.vm.startupTime) & Squeak.MillisecondClockMask;
    },
    millisecondClockValueSet: function(clock) {
        // set millisecondClock to the (previously saved) clock value
        // to allow "stopping" the VM clock while debugging
        this.vm.startupTime = Date.now() - clock;
    },
    secondClock: function() {
        return this.pos32BitIntFor(Squeak.totalSeconds()); // will overflow 32 bits in 2037
    },
    microsecondClock: function(state) {
        var millis = Date.now() - state.epoch;
        if (typeof performance !== "object")
            return this.pos53BitIntFor(millis * 1000);
        // use high-res clock, adjust for roll-over
        var micros = performance.now() * 1000 % 1000 | 0,
            oldMillis = state.millis,
            oldMicros = state.micros;
        if (oldMillis > millis) millis = oldMillis;                 // rolled over previously
        if (millis === oldMillis && micros < oldMicros) millis++;   // roll over now
        state.millis = millis;
        state.micros = micros;
        return this.pos53BitIntFor(millis * 1000 + micros);
    },
    microsecondClockUTC: function() {
        if (!this.microsecondClockUTCState)
            this.microsecondClockUTCState = {epoch: Squeak.EpochUTC, millis: 0, micros: 0};
        return this.microsecondClock(this.microsecondClockUTCState);
    },
    microsecondClockLocal: function() {
        if (!this.microsecondClockLocalState)
            this.microsecondClockLocalState = {epoch: Squeak.Epoch, millis: 0, micros: 0};
        return this.microsecondClock(this.microsecondClockLocalState);
    },
    primitiveUtcWithOffset: function(argCount) {
        var d = new Date();
        var posixMicroseconds = this.pos53BitIntFor(d.getTime() * 1000);
        var offset = -60 * d.getTimezoneOffset();
        if (argCount > 0) {
            // either an Array or a DateAndTime in new UTC format with two ivars
            var stWordIndexableObject = this.vm.stackValue(0);
            stWordIndexableObject.pointers[0] = posixMicroseconds;
            stWordIndexableObject.pointers[1] = offset;
            this.popNandPushIfOK(argCount + 1, stWordIndexableObject);
            return true;
        }
        var timeAndOffset = [
            posixMicroseconds,
            offset,
        ];
        this.popNandPushIfOK(argCount + 1, this.makeStArray(timeAndOffset));
        return true;
    },
});
