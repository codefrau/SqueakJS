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
});

Object.extend(Squeak.Primitives.prototype,
'FFI', {
    ffi_primitiveCalloutWithArgs: function(argCount) {
        var extLibFunc = this.stackNonInteger(1),
            argsObj = this.stackNonInteger(0);
        if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
        var moduleName = extLibFunc.pointers[Squeak.ExtLibFunc_module].bytesAsString();
        var funcName = extLibFunc.pointers[Squeak.ExtLibFunc_name].bytesAsString();
        var args = argsObj.pointers.join(', ');
        this.vm.warnOnce('FFI: ignoring ' + moduleName + ': ' + funcName + '(' + args + ')');
        return false;
    },
});
