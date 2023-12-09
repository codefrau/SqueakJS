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
        var jsArgs = [];
        for (var i = 0; i < stArgs.length; i++) {
            jsArgs.push(this.js_fromStObject(stArgs[i])); // from JSBridge
        }
        var jsResult = module[funcName].apply(this, jsArgs);
        var stResult = this.makeStObject(jsResult);
        return this.popNandPushIfOK(argCount + 1, stResult);
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
