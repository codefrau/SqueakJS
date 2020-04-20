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

Object.extend(Squeak.Primitives.prototype,
'JavaScriptPlugin', {
    js_primitiveDoUnderstand: function(argCount) {
        // This is JS's doesNotUnderstand handler,
        // as well as JS class's doesNotUnderstand handler.
        // Property name is the selector up to first colon.
        // If it is 'new', create an instance;
        // otherwise if the property is a function, call it;
        // otherwise if the property exists, get/set it;
        // otherwise, fail.
        var rcvr = this.stackNonInteger(1),
            obj = this.js_objectOrGlobal(rcvr),
            message = this.stackNonInteger(0).pointers,
            selector = message[0].bytesAsString(),
            args = message[1].pointers || [],
            isGlobal = !('jsObject' in rcvr),
            jsResult = null;
        try {
            var propName = selector.match(/([^:]*)/)[0];
            if (!isGlobal && propName === "new") {
                if (args.length === 0) {
                    // new this()
                    jsResult = new obj();
                } else {
                    // new this(arg0, arg1, ...)
                    var newArgs = [null].concat(this.js_fromStArray(args));
                    jsResult = new (Function.prototype.bind.apply(obj, newArgs));
                }
            } else {
                if (!(propName in obj))
                    return this.js_setError("Property not found: " + propName);
                var propValue = obj[propName];
                if (typeof propValue == "function" && (!isGlobal || args.length > 0)) {
                    // do this[selector](arg0, arg1, ...)
                    jsResult = propValue.apply(obj, this.js_fromStArray(args));
                } else {
                    if (args.length == 0) {
                        // do this[selector]
                        jsResult = propValue;
                    } else if (args.length == 1) {
                        // do this[selector] = arg0
                        obj[propName] = this.js_fromStObject(args[0]);
                    } else {
                        // cannot do this[selector] = arg0, arg1, ...
                        return this.js_setError("Property " + propName + " is not a function");
                    }
                }
            }
        } catch(err) {
            return this.js_setError(err.message);
        }
        var stResult = this.makeStObject(jsResult, rcvr.sqClass);
        return this.popNandPushIfOK(argCount + 1, stResult);
    },
    js_primitiveAsString: function(argCount) {
        var obj = this.js_objectOrGlobal(this.stackNonInteger(0));
        return this.popNandPushIfOK(argCount + 1, this.makeStString(String(obj)));
    },
    js_primitiveTypeof: function(argCount) {
        var obj = this.js_objectOrGlobal(this.stackNonInteger(0));
        return this.popNandPushIfOK(argCount + 1, this.makeStString(typeof obj));
    },
    js_primitiveAt: function(argCount) {
        var rcvr = this.stackNonInteger(1),
            propName = this.vm.stackValue(0),
            propValue;
        try {
            var jsRcvr = this.js_objectOrGlobal(rcvr),
                jsPropName = this.js_fromStObject(propName),
                jsPropValue = jsRcvr[jsPropName];
            propValue = this.makeStObject(jsPropValue, rcvr.sqClass);
        } catch(err) {
            return this.js_setError(err.message);
        }
        return this.popNandPushIfOK(argCount + 1, propValue);
    },
    js_primitiveAtPut: function(argCount) {
        var rcvr = this.stackNonInteger(2),
            propName = this.vm.stackValue(1),
            propValue = this.vm.stackValue(0);
        try {
            var jsRcvr = this.js_objectOrGlobal(rcvr),
                jsPropName = this.js_fromStObject(propName),
                jsPropValue = this.js_fromStObject(propValue);
            jsRcvr[jsPropName] = jsPropValue;
        } catch(err) {
            return this.js_setError(err.message);
        }
        return this.popNandPushIfOK(argCount + 1, propValue);
    },
    js_primitiveSqueakAsJSObject: function(argCount) {
        var rcvr = this.stackNonInteger(1),
            arg = this.vm.stackValue(0);
        if (this.success) rcvr.jsObject = arg;
        return this.popNIfOK(argCount);
    },
    js_primitiveInitCallbacks: function(argCount) {
        // set callback semaphore for js_fromStBlock()
        this.js_callbackSema = this.stackInteger(0);
        this.js_activeCallback = null;
        return this.popNIfOK(argCount);
    },
    js_primitiveGetActiveCallbackBlock: function(argCount) {
        // we're inside an active callback, get block
        var callback = this.js_activeCallback;
        if (!callback) return this.js_setError("No active callback");
        return this.popNandPushIfOK(argCount+1, callback.block);
    },
    js_primitiveGetActiveCallbackArgs: function(argCount) {
        // we're inside an active callback, get args
        var proxyClass = this.stackNonInteger(argCount),
            callback = this.js_activeCallback;
        if (!callback) return this.js_setError("No active callback");
        try {
            // make array with expected number of arguments for block
            var array = this.makeStArray(callback.args, proxyClass);
            return this.popNandPushIfOK(argCount+1, array);
        } catch(err) {
            return this.js_setError(err.message);
        }
    },
    js_primitiveReturnFromCallback: function(argCount) {
        if (argCount !== 1) return false;
        if (!this.js_activeCallback)
            return this.js_setError("No active callback");
        // set result so the interpret loop in js_executeCallback() terminates
        this.js_activeCallback.result = this.vm.pop();
        this.vm.breakOut(); // stop interpreting ASAP
        return true;
    },
    js_primitiveGetError: function(argCount) {
        var error = this.makeStObject(this.js_error);
        this.js_error = null;
        return this.popNandPushIfOK(argCount + 1, error);
    },
    js_setError: function(err) {
        this.js_error = String(err);
        return false;
    },
    js_fromStObject: function(obj) {
        if (typeof obj === "number") return obj;
        if (obj.jsObject) return obj.jsObject;
        if (obj.isFloat) return obj.float;
        if (obj.isNil) return null;
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        if (obj.bytes || obj.sqClass === this.vm.specialObjects[Squeak.splOb_ClassString])
            return obj.bytesAsString();
        if (obj.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray])
            return this.js_fromStArray(obj.pointers || [], true);
        if (obj.sqClass === this.vm.specialObjects[Squeak.splOb_ClassBlockContext] ||
            obj.sqClass === this.vm.specialObjects[Squeak.splOb_ClassBlockClosure])
            return this.js_fromStBlock(obj);
        throw Error("asJSArgument needed for " + obj);
    },
    js_fromStArray: function(objs, maybeDict) {
        if (objs.length > 0 && maybeDict && this.isAssociation(objs[0]))
            return this.js_fromStDict(objs);
        var jsArray = [];
        for (var i = 0; i < objs.length; i++)
            jsArray.push(this.js_fromStObject(objs[i]));
        return jsArray;
    },
    js_fromStDict: function(objs) {
        var jsDict = {};
        for (var i = 0; i < objs.length; i++) {
            var assoc = objs[i].pointers;
            if (!assoc || assoc.length !== 2) throw Error(assoc + " is not an Association");
            var jsKey = this.js_fromStObject(assoc[0]),
                jsValue = this.js_fromStObject(assoc[1]);
            jsDict[jsKey] = jsValue;
        }
        return jsDict;
    },
    js_fromStBlock: function(block) {
        // create callback function from block or closure
        if (!this.js_callbackSema) // image recognizes error string and will try again
            throw Error("CallbackSemaphore not set");
        // block holds onto thisContext
        this.vm.reclaimableContextCount = 0;
        var numArgs = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof numArgs !== 'number')
            numArgs = block.pointers[Squeak.Closure_numArgs];
        var squeak = this;
        return function evalSqueakBlock(/* arguments */) {
            var args = [];
            for (var i = 0; i < numArgs; i++)
                args.push(arguments[i]);
            return new Promise(function(resolve, reject) {
                function evalAsync() {
                    squeak.js_executeCallbackAsync(block, args, resolve, reject);
                }
                self.setTimeout(evalAsync, 0);
            });
        }
    },
    js_executeCallbackAsync: function(block, args, resolve, reject) {
        var squeak = this;
        function again() {squeak.js_executeCallbackAsync(block, args, resolve, reject)}
        if (!this.js_activeCallback && !this.vm.frozen) {
            this.js_executeCallback(block, args, resolve, reject);
        } else {
            self.setTimeout(again, 0);
        }
    },
    js_executeCallback: function(block, args, resolve, reject) {
        if (this.js_activeCallback)
            return console.error("Callback: already active");
        // make block and args available to primitiveGetActiveCallback
        this.js_activeCallback = {
            block: block,
            args: args,
            result: null,
        };
        // switch to callback handler process ASAP
        this.signalSemaphoreWithIndex(this.js_callbackSema);
        this.vm.forceInterruptCheck();
        // interpret until primitiveReturnFromCallback sets result
        var timeout = Date.now() + 500;
        while (Date.now() < timeout && !this.js_activeCallback.result)
            this.vm.interpret();
        var result = this.js_activeCallback.result;
        this.js_activeCallback = null;
        if (result) {
            // return result to JS caller as JS object or string
            try { resolve(this.js_fromStObject(result)); }
            catch(err) { resolve(result.toString()); }
        } else {
            reject(Error("SqueakJS timeout"));
        }
    },
    js_objectOrGlobal: function(sqObject) {
        return 'jsObject' in sqObject ? sqObject.jsObject : self;
    },
});
