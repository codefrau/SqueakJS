"use strict";
/*
 * Copyright (c) 2013-2025 Vanessa Freudenberg
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
    FFIFlagAtomicPointer: 0x60000, // baseType is atomic and pointer (array)
    FFIFlagMask: 0x70000, // mask for flags
    FFIStructSizeMask: 0xFFFF, // mask for max size of structure
    FFIAtomicTypeMask: 0x0F000000, // mask for atomic type spec
    FFIAtomicTypeShift: 24, // shift for atomic type
});

Object.extend(Squeak.Primitives.prototype,
'FFI', {
    // naming:
    //   - ffi_* for public methods of SqueakFFIPrims module
    //     (see vm.plugins.js)
    //   - other ffi* for private methods of this module
    //   - primitiveCalloutToFFI: old callout primitive (not in SqueakFFIPrims)
    ffi_lastError: 0,

    ffiModules: {}, // map library name to module name

    ffiFuncs: [], // functions loaded via dlsym (index + 1 is handle)

    // create an external address as handle for a function dynamically
    // this is a hook for other modules equivalent to dlsym() in C.
    // Later we can retrieve the module and func by handle
    ffiLookupFunc: function(mod, funcName) {
        var handle = this.ffiFuncs.findIndex(func => func.funcName === funcName) + 1;
        if (!handle) {
            if (!mod[funcName]) return 0;
            // we could keep a reverse map, but this is not time-critical
            var modName = Object.keys(this.loadedModules).find(name => this.loadedModules[name] === mod);
            if (modName === undefined) throw Error("FFI: module not loaded?! " + mod.getModuleName());
            var libName = Object.keys(this.ffiModules).find(name => this.ffiModules[name] === modName);
            if (libName === undefined) throw Error("FFI: library not found?! " +  mod.getModuleName());
            this.ffiFuncs.push({libName: libName, modName: modName, funcName: funcName});
            handle = this.ffiFuncs.length;
        }
        return handle;
    },

    ffiDoCallout: function(argCount, extLibFunc, stArgs) {
        this.ffi_lastError = Squeak.FFIErrorGenericError;
        var libName = extLibFunc.pointers[Squeak.ExtLibFunc_module].bytesAsString();
        var funcName = extLibFunc.pointers[Squeak.ExtLibFunc_name].bytesAsString();
        var funcAddr = extLibFunc.pointers[Squeak.ExtLibFunc_handle].wordsOrBytes()[0];
        var modName = this.ffiModules[libName];

        if (funcAddr) {
            var func = this.ffiFuncs[funcAddr];
            if (!func) throw Error("FFI: not a valid External Address: " + funcAddr);
            libName = func.libName;
            modName = func.modName;
            funcName = func.funcName;
        }

        if (!libName) libName = "libc"; // default to libc

        if (modName === undefined) {
            if (!Squeak.externalModules[libName]) {
                var prefixes = ["", "lib"];
                var suffixes = ["", ".so",
                    ".so.9", ".9", ".so.8", ".8", ".so.7", ".7",
                    ".so.6", ".6", ".so.5", ".5", ".so.4", ".4",
                    ".so.3", ".3", ".so.2", ".2", ".so.1", ".1"];
                loop: for (var p = 0; p < prefixes.length; p++) {
                    var prefix = prefixes[p];
                    for (var s = 0; s < suffixes.length; s++) {
                        var suffix = suffixes[s];
                        if (Squeak.externalModules[prefix + libName + suffix]) {
                            modName = prefix + libName + suffix;
                            break loop;
                        }
                        if (prefix && libName.startsWith(prefix) && Squeak.externalModules[libName.slice(prefix.length) + suffix]) {
                            modName = libName.slice(prefix.length) + suffix;
                            break loop;
                        }
                        if (suffix && libName.endsWith(suffix) && Squeak.externalModules[prefix + libName.slice(0, -suffix.length)]) {
                            modName = prefix + libName.slice(0, -suffix.length);
                            break loop;
                        }
                    }
                }
                if (modName) console.log("FFI: found library " + libName + " as module " + modName);
                // there still is a chance loadModuleDynamically will find it under libName
            }
            if (!modName) modName = libName; // default to libName
            this.ffiModules[libName] = modName;
        }

        var mod = this.loadedModules[modName];
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
            if (!mod) {
                this.vm.warnOnce('FFI: library not found: ' + libName);
            }
        }
        if (!mod) {
            this.ffi_lastError = Squeak.FFIErrorModuleNotFound;
            return false;
        }
        // types[0] is return type, types[1] is first arg type, etc.
        var stTypes = extLibFunc.pointers[Squeak.ExtLibFunc_argTypes].pointers;
        var jsArgs = [];
        for (var i = 0; i < stArgs.length; i++) {
            jsArgs.push(this.ffiArgFromSt(stArgs[i], stTypes[i+1]));
        }
        var jsResult;
        if (!(funcName in mod)) {
            if (this.vm.warnOnce('FFI: function not found: ' + libName + '::' + funcName)) {
                console.warn(jsArgs);
            }
            if (mod.ffiFunctionNotFoundHandler) {
                jsResult = mod.ffiFunctionNotFoundHandler(funcName, jsArgs);
            }
            if (jsResult === undefined) {
                this.ffi_lastError = Squeak.FFIErrorAddressNotFound;
                return false;
            }
        } else {
            jsResult = mod[funcName].apply(mod, jsArgs);
        }
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
                        if (stObj.isTrue) return true;
                        if (stObj.isFalse) return false;
                        if (typeof stObj === "number") return !!stObj;
                        if (stObj.isFloat) return !!stObj.float;
                        throw Error("FFI: expected bool, got " + stObj);
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
                        if (stObj.isFloat) return stObj.float;
                        throw Error("FFI: expected float, got " + stObj);
                    default:
                        throw Error("FFI: unimplemented atomic arg type: " + atomicType);
                }
            case Squeak.FFIFlagAtomicPointer:
                // array of values
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeUnsignedChar8:
                    case Squeak.FFITypeUnsignedInt8:
                        if (stObj.bytes) return stObj.bytes;
                        if (stObj.words) return stObj.wordsAsUint8Array();
                        if (this.interpreterProxy.isWordsOrBytes(stObj)) return new Uint8Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Uint8Array) return data;
                            if (data instanceof ArrayBuffer) return new Uint8Array(data);
                        }
                        throw Error("FFI: expected bytes, got " + stObj);
                    case Squeak.FFITypeUnsignedInt32:
                        if (stObj.words) return stObj.words;
                        if (this.interpreterProxy.isWords(stObj)) return new Uint32Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Uint32Array) return data;
                            if (data instanceof ArrayBuffer) return new Uint32Array(data);
                        }
                        throw Error("FFI: expected words, got " + stObj);
                    case Squeak.FFITypeSignedInt32:
                        if (stObj.words) return stObj.wordsAsInt32Array();
                        if (this.interpreterProxy.isWords(stObj)) return new Int32Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Int32Array) return data;
                            if (data instanceof ArrayBuffer) return new Int32Array(data);
                        }
                        throw Error("FFI: expected words, got " + stObj);
                    case Squeak.FFITypeSingleFloat:
                        if (stObj.words) return stObj.wordsAsFloat32Array();
                        if (stObj.isFloat) return new Float32Array([stObj.float]);
                        if (this.interpreterProxy.isWords(stObj)) return new Float32Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Float32Array) return data;
                            if (data instanceof ArrayBuffer) return new Float32Array(data);
                        }
                        throw Error("FFI: expected floats, got " + stObj);
                    case Squeak.FFITypeDoubleFloat:
                        if (stObj.words) return stObj.wordsAsFloat64Array();
                        if (stObj.isFloat) return new Float64Array([stObj.float]);
                        if (this.interpreterProxy.isWords(stObj)) return new Float64Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Float64Array) return data;
                            if (data instanceof ArrayBuffer) return new Float64Array(data);
                        }
                        throw Error("FFI: expected floats, got " + stObj);
                    case Squeak.FFITypeVoid: // void* is passed as buffer
                        if (stObj.words) return stObj.words.buffer;
                        if (stObj.bytes) return stObj.bytes.buffer;
                        if (stObj.isNil || this.interpreterProxy.isWordsOrBytes(stObj)) return new ArrayBuffer(0); // null pointer
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof ArrayBuffer) return data;
                        }
                        throw Error("FFI: expected words or bytes, got " + stObj);
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
                    case Squeak.FFITypeSingleFloat:
                    case Squeak.FFITypeDoubleFloat:
                        if (typeof jsResult !== "number") throw Error("FFI: expected number, got " + jsResult);
                        return this.makeStObject(jsResult);
                    default:
                        throw Error("FFI: unimplemented atomic return type: " + atomicType);
                }
            case Squeak.FFIFlagAtomicPointer:
                // array of values
                if (!jsResult) return this.vm.nilObj;
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    // char* is returned as string
                    case Squeak.FFITypeSignedChar8:
                    case Squeak.FFITypeUnsignedChar8:
                        if (typeof jsResult === "string") return this.makeStString(jsResult);
                        else return this.makeStStringFromBytes(jsResult, true);
                    // all other arrays are returned as ExternalData
                    default:
                        return this.ffiMakeStExternalData(jsResult, stType);
                }
            default:
                throw Error("FFI: unimplemented return type flags: " + typeSpec);
        }
    },
    ffiNextExtAddr: 0, // fake addresses for ExternalAddress objects
    ffiMakeStExternalAddress: function() {
        var extAddr = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassExternalAddress], 4);
        new (Uint32Array)(extAddr.bytes.buffer)[0] = ++this.ffiNextExtAddr;
        return extAddr;
    },
    ffiMakeStExternalData: function(jsData, stType) {
        var extAddr = this.ffiMakeStExternalAddress();
        extAddr.jsData = jsData; // save for later
        var extData = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassExternalData], 0);
        extData.pointers[0] = extAddr;
        extData.pointers[1] = stType;
        return extData;
    },
    ffiDataFromStack: function(arg) {
        var oop = this.stackNonInteger(arg);
        if (oop.jsData !== undefined) return oop.jsData;
        if (oop.bytes) return oop.bytes;
        if (oop.words) return oop.words;
        this.vm.warnOnce("FFI: expected ExternalAddress with jsData, got " + oop);
        this.success = false;
    },
    ffi_primitiveFFIAllocate: function(argCount) {
        var size = this.stackInteger(0);
        if (!this.success) return false;
        var extAddr = this.ffiMakeStExternalAddress();
        extAddr.jsData = new ArrayBuffer(size);
        return this.popNandPushIfOK(argCount + 1, extAddr);
    },
    ffi_primitiveFFIFree: function(argCount) {
        var extAddr = this.stackNonInteger(0);
        if (!this.success) return false;
        if (extAddr.jsData === undefined) {
            this.vm.warnOnce("primitiveFFIFree: expected ExternalAddress with jsData, got " + extAddr);
            return false;
        }
        delete extAddr.jsData;
        return true;
    },
    primitiveCalloutToFFI: function(argCount, method) {
        var extLibFunc = method.pointers[1];
        if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
        var args = [];
        for (var i = argCount - 1; i >= 0; i--)
            args.push(this.vm.stackValue(i));
        return this.ffiDoCallout(argCount, extLibFunc, args);
    },
    ffi_primitiveCalloutWithArgs: function(argCount) {
        var extLibFunc = this.stackNonInteger(1),
            argsObj = this.stackNonInteger(0);
        if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
        return this.ffiDoCallout(argCount, extLibFunc, argsObj.pointers);
    },
    ffi_primitiveFFIGetLastError: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.ffi_lastError);
    },
    ffi_primitiveFFIIntegerAt: function(argCount) {
        var data = this.ffiDataFromStack(3),
            byteOffset = this.stackInteger(2),
            byteSize = this.stackInteger(1),
            isSigned = this.stackBoolean(0);
        if (!this.success) return false;
        byteOffset--; // 1-based indexing
        if (byteOffset < 0 || byteSize < 1 || byteSize > 8 ||
            (byteSize & (byteSize - 1)) !== 0) return false;
        var result;
        if (byteSize === 1 && !isSigned) {
            if (typeof data === "string") {
                result = data.charCodeAt(byteOffset) || 0; // 0 if out of bounds
            } else if (data instanceof Uint8Array) {
                result = data[byteOffset] || 0; // 0 if out of bounds
            } else {
                this.vm.warnOnce("FFI: expected string or Uint8Array, got " + typeof data);
                return false;
            }
        } else if (byteSize === 4 && !isSigned) {
            if (data instanceof Uint32Array) {
                result = data[byteOffset] || 0; // 0 if out of bounds
            } else if (data instanceof Uint8Array) {
                result = new DataView(data.buffer).getUint32(data.byteOffset + byteOffset, true) || 0; // 0 if out of bounds
            } else {
                this.vm.warnOnce("FFI: expected Uint32Array, got " + typeof data);
                return false;
            }
        } else {
            this.vm.warnOnce("FFI: unimplemented integer type size: " + byteSize + " signed: " + isSigned);
            return false;
        }
        return this.popNandPushIfOK(argCount + 1, result);
    },
    ffi_primitiveFFIIntegerAtPut: function(argCount) {
        var data = this.ffiDataFromStack(4),
            byteOffset = this.stackInteger(3),
            value = this.stackSigned53BitInt(2), // good up to int32 / uint32
            byteSize = this.stackInteger(1),
            isSigned = this.stackBoolean(0);
        if (!this.success) return false;
        byteOffset--; // 1-based indexing
        if (byteOffset < 0 || byteSize < 1 || byteSize > 8 ||
            (byteSize & (byteSize - 1)) !== 0) return false;
        if (byteSize === 4) {
            if (( isSigned && (value < -0x80000000 || value > 0x7FFFFFFF)) ||
                (!isSigned && (value < 0 || value > 0xFFFFFFFF))) return false;
            if (data instanceof Uint32Array) {
                data[byteOffset] = value >>> 0;   // storage is always unsigned
            } else if (data instanceof Uint8Array) {
                new DataView(data.buffer).setUint32(data.byteOffset + byteOffset, value >>> 0, true);
            } else {
                this.vm.warnOnce("FFI: expected Uint32Array, got " + typeof data);
                return false;
            }
        } else {
            this.vm.warnOnce("FFI: unimplemented integer type size: " + byteSize + " signed: " + isSigned);
            return false;
        }
        return this.popNandPushIfOK(argCount + 1, value);
    },
    ffi_primitiveFFIDoubleAtPut: function(argCount) {
        var data = this.ffiDataFromStack(2),
            byteOffset = this.stackInteger(1),
            valueOop = this.vm.stackValue(0),
            value = valueOop.isFloat ? valueOop.float : valueOop;
        if (!this.success || typeof value !== "number") return false;
        byteOffset--; // 1-based indexing
        if (byteOffset & 7) new DataView(data).setFloat64(byteOffset, value, true);
        else new Float64Array(data)[byteOffset / 8] = value;
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
});
