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
"known classes", {
    // ExternalLibraryFunction layout:
    ExtLibFunc_handle: 0,
    ExtLibFunc_flags: 1,
    ExtLibFunc_argTypes: 2,
    ExtLibFunc_name: 3,
    ExtLibFunc_module: 4,
    ExtLibFunc_errorCodeName: 5,
},
"FFI error codes", {
    FFINoCalloutAvailable: -1, // No callout mechanism available
    FFIErrorGenericError: 0, // generic error
    FFIErrorNotFunction: 1, // primitive invoked without ExternalFunction
    FFIErrorBadArgs: 2, // bad arguments to primitive call
    FFIErrorBadArg: 3, // generic bad argument
    FFIErrorIntAsPointer: 4, // int passed as pointer
    FFIErrorBadAtomicType: 5, // bad atomic type (e.g., unknown)
    FFIErrorCoercionFailed: 6, // argument coercion failed
    FFIErrorWrongType: 7, // Type check for non-atomic types failed
    FFIErrorStructSize: 8, // struct size wrong or too large
    FFIErrorCallType: 9, // unsupported calling convention
    FFIErrorBadReturn: 10, // cannot return the given type
    FFIErrorBadAddress: 11, // bad function address
    FFIErrorNoModule: 12, // no module given but required for finding address
    FFIErrorAddressNotFound: 13, // function address not found
    FFIErrorAttemptToPassVoid: 14, // attempt to pass 'void' parameter
    FFIErrorModuleNotFound: 15, // module not found
    FFIErrorBadExternalLibrary: 16, // external library invalid
    FFIErrorBadExternalFunction: 17, // external function invalid
    FFIErrorInvalidPointer: 18, // ExternalAddress points to ST memory (don't you dare to do this!)
    FFIErrorCallFrameTooBig: 19, // Stack frame required more than 16k bytes to pass arguments.
},
"FFI types", {
    // type void
    FFITypeVoid: 0,
    // type bool
    FFITypeBool: 1,
    // basic integer types.
    // note: (integerType anyMask: 1) = integerType isSigned
    FFITypeUnsignedInt8: 2,
    FFITypeSignedInt8: 3,
    FFITypeUnsignedInt16: 4,
    FFITypeSignedInt16: 5,
    FFITypeUnsignedInt32: 6,
    FFITypeSignedInt32: 7,
    FFITypeUnsignedInt64: 8,
    FFITypeSignedInt64: 9,
    // original character types
    // note: isCharacterType ^type >> 1 >= 5 and: [(type >> 1) odd]
    FFITypeUnsignedChar8: 10,
    FFITypeSignedChar8: 11, // N.B. misnomer!
    // float types
    // note: isFloatType ^type >> 1 = 6
    FFITypeSingleFloat: 12,
    FFITypeDoubleFloat: 13,
    // new character types
    // note: isCharacterType ^type >> 1 >= 5 and: [(type >> 1) odd]
    FFITypeUnsignedChar16: 14,
    FFITypeUnsignedChar32: 15,
    // type flags
    FFIFlagAtomic: 0x40000, // type is atomic
    FFIFlagPointer: 0x20000, // type is pointer to base type (a.k.a. array)
    FFIFlagStructure: 0x10000, // baseType is structure of 64k length
    FFIFlagAtomicArray: 0x60000, // baseType is atomic and array
    FFIFlagMask: 0x70000, // mask for flags
    FFIStructSizeMask: 0xFFFF, // mask for max size of structure
    FFIAtomicTypeMask: 0x0F000000, // mask for atomic type spec
    FFIAtomicTypeShift: 24, // shift for atomic type
});

Object.extend(Squeak.Primitives.prototype,
'FFI', {
    ffi_lastError: 0,
    calloutToFFI: function(argCount, extLibFunc, stArgs) {
        var moduleName = extLibFunc.pointers[Squeak.ExtLibFunc_module].bytesAsString();
        var funcName = extLibFunc.pointers[Squeak.ExtLibFunc_name].bytesAsString();
        var module = Squeak.externalModules[moduleName];
        if (!module || typeof module[funcName] !== 'function') {
            this.vm.warnOnce('FFI: function not found: ' + moduleName + '::' + funcName + '()');
            return false;
        }
        // types[0] is return type, types[1] is first arg type, etc.
        var stTypes = extLibFunc.pointers[Squeak.ExtLibFunc_argTypes].pointers;
        var jsArgs = [];
        for (var i = 0; i < stArgs.length; i++) {
            jsArgs.push(this.ffiArgFromSt(stArgs[i], stTypes[i+1]));
        }
        var jsResult = module[funcName].apply(module, jsArgs);
        var stResult = this.ffiResultToSt(jsResult, stTypes[0]);
        return this.popNandPushIfOK(argCount + 1, stResult);
    },
    ffiArgFromSt: function(stObj, stType) {
        var typeSpec = stType.pointers[0].words[0];
        switch (typeSpec & Squeak.FFIFlagMask) {
            case Squeak.FFIFlagAtomic:
                // single value
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeVoid:
                        return null;
                    case Squeak.FFITypeBool:
                        return !stObj.isFalse;
                    case Squeak.FFITypeUnsignedInt8:
                    case Squeak.FFITypeSignedInt8:
                    case Squeak.FFITypeUnsignedInt16:
                    case Squeak.FFITypeSignedInt16:
                    case Squeak.FFITypeUnsignedInt32:
                    case Squeak.FFITypeSignedInt32:
                    case Squeak.FFITypeUnsignedInt64:
                    case Squeak.FFITypeSignedInt64:
                    case Squeak.FFITypeUnsignedChar8:
                    case Squeak.FFITypeSignedChar8:
                    case Squeak.FFITypeUnsignedChar16:
                    case Squeak.FFITypeUnsignedChar32:
                        // we ignore the signedness and size of the integer for now
                        if (typeof stObj === "number") return stObj;
                        throw Error("FFI: expected integer, got " + stObj);
                    case Squeak.FFITypeSingleFloat:
                    case Squeak.FFITypeDoubleFloat:
                        if (typeof stObj === "number") return stObj;
                        if (typeof stObj.isFloat) return stObj.float;
                        throw Error("FFI: expected float, got " + stObj);
                    default:
                        throw Error("FFI: unimplemented atomic arg type: " + atomicType);
                }
            case Squeak.FFIFlagAtomicArray:
                // array of values
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeUnsignedChar8:
                        if (stObj.bytes) return stObj.bytesAsString();
                        throw Error("FFI: expected string, got " + stObj);
                    case Squeak.FFITypeUnsignedInt8:
                        if (stObj.bytes) return stObj.bytes;
                        if (stObj.words) return stObj.wordsAsUint8Array();
                        throw Error("FFI: expected bytes, got " + stObj);
                    case Squeak.FFITypeSingleFloat:
                        if (stObj.words) return stObj.wordsAsFloat32Array();
                        throw Error("FFI: expected float array, got " + stObj);
                    default:
                        throw Error("FFI: unimplemented atomic array arg type: " + atomicType);
                }
            default:
                throw Error("FFI: unimplemented arg type flags: " + typeSpec);
        }
    },
    ffiResultToSt: function(jsResult, stType) {
        var typeSpec = stType.pointers[0].words[0];
        switch (typeSpec & Squeak.FFIFlagMask) {
            case Squeak.FFIFlagAtomic:
                // single value
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeVoid:
                        return this.vm.nilObj;
                    case Squeak.FFITypeBool:
                        return jsResult ? this.vm.trueObj : this.vm.falseObj;
                    case Squeak.FFITypeUnsignedInt8:
                    case Squeak.FFITypeSignedInt8:
                    case Squeak.FFITypeUnsignedInt16:
                    case Squeak.FFITypeSignedInt16:
                    case Squeak.FFITypeUnsignedInt32:
                    case Squeak.FFITypeSignedInt32:
                    case Squeak.FFITypeUnsignedInt64:
                    case Squeak.FFITypeSignedInt64:
                    case Squeak.FFITypeUnsignedChar8:
                    case Squeak.FFITypeSignedChar8:
                    case Squeak.FFITypeUnsignedChar16:
                    case Squeak.FFITypeUnsignedChar32:
                        // we ignore the signedness and size of the integer for now
                        return this.makeStInt(jsResult);
                    case Squeak.FFITypeSingleFloat:
                    case Squeak.FFITypeDoubleFloat:
                        return this.makeStFloat(jsResult);
                    default:
                        throw Error("FFI: unimplemented atomic return type: " + atomicType);
                }
            case Squeak.FFIFlagAtomicArray:
                // array of values
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeUnsignedChar8:
                        return this.makeStString(jsResult);
                    default:
                        throw Error("FFI: unimplemented atomic array return type: " + atomicType);
                }
            default:
                throw Error("FFI: unimplemented return type flags: " + typeSpec);
        }
    },
    primitiveCalloutToFFI: function(argCount, method) {
        var extLibFunc = method.pointers[1];
        if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
        var args = [];
        for (var i = argCount - 1; i >= 0; i--)
            args.push(this.vm.stackValue(i));
        return this.calloutToFFI(argCount, extLibFunc, args);
    },
    ffi_primitiveCalloutWithArgs: function(argCount) {
        var extLibFunc = this.stackNonInteger(1),
            argsObj = this.stackNonInteger(0);
        if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
        return this.calloutToFFI(argCount, extLibFunc, argsObj.pointers);
    },
    ffi_primitiveFFIGetLastError: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.ffi_lastError);
    },
});
