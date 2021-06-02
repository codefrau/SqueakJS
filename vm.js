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

Object.extend(Squeak,
"version", {
    // system attributes
    vmVersion: "SqueakJS 1.0.4",
    vmDate: "2021-05-31",               // Maybe replace at build time?
    vmBuild: "unknown",                 // or replace at runtime by last-modified?
    vmPath: "unknown",                  // Replace at runtime
    vmFile: "vm.js",
    vmMakerVersion: "[VMMakerJS-bf.17 VMMaker-bf.353]", // for Smalltalk vmVMMakerVersion
    platformName: "JS",
    platformSubtype: "unknown",         // Replace at runtime
    osVersion: "unknown",               // Replace at runtime
    windowSystem: "unknown",            // Replace at runtime
},
"object header", {
    // object headers
    HeaderTypeMask: 3,
    HeaderTypeSizeAndClass: 0, //3-word header
    HeaderTypeClass: 1,        //2-word header
    HeaderTypeFree: 2,         //free block
    HeaderTypeShort: 3,        //1-word header
},
"special objects", {
    // Indices into SpecialObjects array
    splOb_NilObject: 0,
    splOb_FalseObject: 1,
    splOb_TrueObject: 2,
    splOb_SchedulerAssociation: 3,
    splOb_ClassBitmap: 4,
    splOb_ClassInteger: 5,
    splOb_ClassString: 6,
    splOb_ClassArray: 7,
    splOb_SmalltalkDictionary: 8,
    splOb_ClassFloat: 9,
    splOb_ClassMethodContext: 10,
    splOb_ClassBlockContext: 11,
    splOb_ClassPoint: 12,
    splOb_ClassLargePositiveInteger: 13,
    splOb_TheDisplay: 14,
    splOb_ClassMessage: 15,
    splOb_ClassCompiledMethod: 16,
    splOb_TheLowSpaceSemaphore: 17,
    splOb_ClassSemaphore: 18,
    splOb_ClassCharacter: 19,
    splOb_SelectorDoesNotUnderstand: 20,
    splOb_SelectorCannotReturn: 21,
    splOb_TheInputSemaphore: 22,
    splOb_SpecialSelectors: 23,
    splOb_CharacterTable: 24,
    splOb_SelectorMustBeBoolean: 25,
    splOb_ClassByteArray: 26,
    splOb_ClassProcess: 27,
    splOb_CompactClasses: 28,
    splOb_TheTimerSemaphore: 29,
    splOb_TheInterruptSemaphore: 30,
    splOb_FloatProto: 31,
    splOb_SelectorCannotInterpret: 34,
    splOb_MethodContextProto: 35,
    splOb_ClassBlockClosure: 36,
    splOb_ClassFullBlockClosure: 37,
    splOb_ExternalObjectsArray: 38,
    splOb_ClassPseudoContext: 39,
    splOb_ClassTranslatedMethod: 40,
    splOb_TheFinalizationSemaphore: 41,
    splOb_ClassLargeNegativeInteger: 42,
    splOb_ClassExternalAddress: 43,
    splOb_ClassExternalStructure: 44,
    splOb_ClassExternalData: 45,
    splOb_ClassExternalFunction: 46,
    splOb_ClassExternalLibrary: 47,
    splOb_SelectorAboutToReturn: 48,
    splOb_SelectorRunWithIn: 49,
    splOb_SelectorAttemptToAssign: 50,
    splOb_PrimErrTableIndex: 51,
    splOb_ClassAlien: 52,
    splOb_InvokeCallbackSelector: 53,
    splOb_ClassUnsafeAlien: 54,
    splOb_ClassWeakFinalizer: 55,
},
"known classes", {
    // AdditionalMethodState layout:
    AdditionalMethodState_selector: 1,
    // Class layout:
    Class_superclass: 0,
    Class_mdict: 1,
    Class_format: 2,
    Class_instVars: null,   // 3 or 4 depending on image, see instVarNames()
    Class_name: 6,
    // ClassBinding layout:
    ClassBinding_value: 1,
    // Context layout:
    Context_sender: 0,
    Context_instructionPointer: 1,
    Context_stackPointer: 2,
    Context_method: 3,
    Context_closure: 4,
    Context_receiver: 5,
    Context_tempFrameStart: 6,
    Context_smallFrameSize: 16,
    Context_largeFrameSize: 56,
    BlockContext_caller: 0,
    BlockContext_argumentCount: 3,
    BlockContext_initialIP: 4,
    BlockContext_home: 5,
    // Closure layout:
    Closure_outerContext: 0,
    Closure_startpc: 1,
    Closure_numArgs: 2,
    Closure_firstCopiedValue: 3,
    ClosureFull_method: 1,
    ClosureFull_receiver: 3,
    ClosureFull_firstCopiedValue: 4,
    // Stream layout:
    Stream_array: 0,
    Stream_position: 1,
    Stream_limit: 2,
    //ProcessorScheduler layout:
    ProcSched_processLists: 0,
    ProcSched_activeProcess: 1,
    //Link layout:
    Link_nextLink: 0,
    //LinkedList layout:
    LinkedList_firstLink: 0,
    LinkedList_lastLink: 1,
    //Semaphore layout:
    Semaphore_excessSignals: 2,
    //Mutex layout:
    Mutex_owner: 2,
    //Process layout:
    Proc_suspendedContext: 1,
    Proc_priority: 2,
    Proc_myList: 3,
    // Association layout:
    Assn_key: 0,
    Assn_value: 1,
    // MethodDict layout:
    MethodDict_array: 1,
    MethodDict_selectorStart: 2,
    // Message layout
    Message_selector: 0,
    Message_arguments: 1,
    Message_lookupClass: 2,
    // Point layout:
    Point_x: 0,
    Point_y: 1,
    // LargeInteger layout:
    LargeInteger_bytes: 0,
    LargeInteger_neg: 1,
    // WeakFinalizationList layout:
    WeakFinalizationList_first: 0,
    // WeakFinalizerItem layout:
    WeakFinalizerItem_list: 0,
    WeakFinalizerItem_next: 1,
},
"constants", {
    MinSmallInt: -0x40000000,
    MaxSmallInt:  0x3FFFFFFF,
    NonSmallInt: -0x50000000,           // non-small and neg (so non pos32 too)
    MillisecondClockMask: 0x1FFFFFFF,
},
"error codes", {
    PrimNoErr: 0,
    PrimErrGenericFailure: 1,
    PrimErrBadReceiver: 2,
    PrimErrBadArgument: 3,
    PrimErrBadIndex: 4,
    PrimErrBadNumArgs: 5,
    PrimErrInappropriate: 6,
    PrimErrUnsupported: 7,
    PrimErrNoModification: 8,
    PrimErrNoMemory: 9,
    PrimErrNoCMemory: 10,
    PrimErrNotFound: 11,
    PrimErrBadMethod: 12,
    PrimErrNamedInternal: 13,
    PrimErrObjectMayMove: 14,
    PrimErrLimitExceeded: 15,
    PrimErrObjectIsPinned: 16,
    PrimErrWritePastObject: 17,
},
"modules", {
    // don't clobber registered modules
    externalModules: Squeak.externalModules || {},
    registerExternalModule: function(name, module) {
        this.externalModules[name] = module;
    },
},
"time", {
    Epoch: Date.UTC(1901,0,1) + (new Date()).getTimezoneOffset()*60000,        // local timezone
    EpochUTC: Date.UTC(1901,0,1),
    totalSeconds: function() {
        // seconds since 1901-01-01, local time
        return Math.floor((Date.now() - Squeak.Epoch) / 1000);
    },
},
"utils", {
    bytesAsString: function(bytes) {
        var chars = [];
        for (var i = 0; i < bytes.length; )
            chars.push(String.fromCharCode.apply(
                null, bytes.subarray(i, i += 16348)));
        return chars.join('');
    },
    word64FromUint32: function(hi, lo) {
        // Max safe integer as Uint64: 001FFFFF_FFFFFFFF
        // Min safe integer as Uint64: FFE00000_00000001
        if (hi < 0x00200000) { // positive, <= 53 bits
            return hi * 0x100000000 + lo;
        } else if (hi > 0xFFE00000) { // negative, <= 53 bits
            return (hi>>0) * 0x100000000 + lo;
        } else return [hi, lo]; // probably SmallFloat
    },
});
