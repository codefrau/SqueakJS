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

Object.subclass('Squeak.InterpreterProxy',
// provides function names exactly like the C interpreter, for ease of porting
// but maybe less efficiently because of the indirection
// only used for plugins translated from Slang (see plugins/*.js)
// built-in primitives use the interpreter directly
'initialization', {
    VM_PROXY_MAJOR: 1,
    VM_PROXY_MINOR: 11,
    initialize: function(vm) {
        this.vm = vm;
        this.remappableOops = [];
        Object.defineProperty(this, 'successFlag', {
          get: function() { return vm.primHandler.success; },
          set: function(success) { vm.primHandler.success = success; },
        });
    },
    majorVersion: function() {
        return this.VM_PROXY_MAJOR;
    },
    minorVersion: function() {
        return this.VM_PROXY_MINOR;
    },
},
'success',
{
    failed: function() {
        return !this.successFlag;
    },
    primitiveFail: function() {
        this.successFlag = false;
    },
    primitiveFailFor: function(reasonCode) {
        this.successFlag = false;
    },
    success: function(boolean) {
        if (!boolean) this.successFlag = false;
    },
},
'stack access',
{
    pop: function(n) {
        this.vm.popN(n);
    },
    popthenPush: function(n, obj) {
        this.vm.popNandPush(n, obj);
    },
    push: function(obj) {
        this.vm.push(obj);
    },
    pushBool: function(bool) {
        this.vm.push(bool ? this.vm.trueObj : this.vm.falseObj);
    },
    pushInteger: function(int) {
        this.vm.push(int);
    },
    pushFloat: function(num) {
        this.vm.push(this.floatObjectOf(num));
    },
    stackValue: function(n) {
        return this.vm.stackValue(n);
    },
    stackIntegerValue: function(n) {
        var int = this.vm.stackValue(n);
        if (typeof int === "number") return int;
        this.successFlag = false;
        return 0;
    },
    stackFloatValue: function(n) {
        this.vm.success = true;
        var float = this.vm.stackIntOrFloat(n);
        if (this.vm.success) return float;
        this.successFlag = false;
        return 0;
    },
    stackObjectValue: function(n) {
        var obj = this.vm.stackValue(n);
        if (typeof obj !== "number") return obj;
        this.successFlag = false;
        return this.vm.nilObj;
    },
    stackBytes: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.bytes) return oop.bytes;
        if (typeof oop === "number" || !oop.isBytes()) this.successFlag = false;
        return [];
    },
    stackWords: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.words;
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackInt32Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsInt32Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackInt16Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsInt16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackUint16Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsUint16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
},
'object access',
{
    isBytes: function(obj) {
        return typeof obj !== "number" && obj.isBytes();
    },
    isWords: function(obj) {
        return typeof obj !== "number" && obj.isWords();
    },
    isWordsOrBytes: function(obj) {
        return typeof obj !== "number" && obj.isWordsOrBytes();
    },
    isPointers: function(obj) {
        return typeof obj !== "number" && obj.isPointers();
    },
    isIntegerValue: function(obj) {
        return typeof obj === "number" && obj >= -0x40000000 && obj <= 0x3FFFFFFF;
    },
    isArray: function(obj) {
        return obj.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray];
    },
    isMemberOf: function(obj, className) {
        var nameBytes = obj.sqClass.pointers[Squeak.Class_name].bytes;
        if (className.length !== nameBytes.length) return false;
        for (var i = 0; i < className.length; i++)
            if (className.charCodeAt(i) !== nameBytes[i]) return false;
        return true;
    },
    booleanValueOf: function(obj) {
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        this.successFlag = false;
        return false;
    },
    positive32BitValueOf: function(obj) {
        return this.vm.primHandler.positive32BitValueOf(obj);
    },
    positive32BitIntegerFor: function(int) {
        return this.vm.primHandler.pos32BitIntFor(int);
    },
    floatValueOf: function(obj) {
        if (obj.isFloat) return obj.float;
        this.successFlag = false;
        return 0;
    },
    floatObjectOf: function(num) {
        return this.vm.primHandler.makeFloat(num);
    },
    fetchPointerofObject: function(n, obj) {
        return obj.pointers[n];
    },
    fetchBytesofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.bytes) return oop.bytes;
        if (oop.words) return oop.wordsAsUint8Array();
        if (typeof oop === "number" || !oop.isWordsOrBytes()) this.successFlag = false;
        return [];
    },
    fetchWordsofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.words;
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchInt32ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsInt32Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchInt16ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsInt16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchUint16ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsUint16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchIntegerofObject: function(n, obj) {
        var int = obj.pointers[n];
        if (typeof int === "number") return int;
        this.successFlag = false;
        return 0;
    },
    fetchLong32ofObject: function(n, obj) {
        return obj.words[n];
    },
    fetchFloatofObject: function(n, obj) {
        return this.floatValueOf(obj.pointers[n]);
    },
    storeIntegerofObjectwithValue: function(n, obj, value) {
        if (typeof value === "number")
            obj.pointers[n] = value;
        else this.successFlag = false;
    },
    storePointerofObjectwithValue: function(n, obj, value) {
        obj.pointers[n] = value;
    },
    stObjectatput: function(array, index, obj) {
        if (array.sqClass !== this.classArray()) throw Error("Array expected");
        if (index < 1 || index >= array.pointers.length) return this.successFlag = false;
        array.pointers[index] = obj;
    },
},
'constant access',
{
    isKindOfInteger: function(obj) {
        return typeof obj === "number" ||
            obj.sqClass == this.classLargeNegativeInteger() ||
            obj.sqClass == this.classLargePositiveInteger();
    },
    classArray: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassArray];
    },
    classBitmap: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassBitmap];
    },
    classSmallInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassInteger];
    },
    classLargePositiveInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger];
    },
    classLargeNegativeInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassLargeNegativeInteger];
    },
    classPoint: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassPoint];
    },
    classString: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassString];
    },
    nilObject: function() {
        return this.vm.nilObj;
    },
    falseObject: function() {
        return this.vm.falseObj;
    },
    trueObject: function() {
        return this.vm.trueObj;
    },
},
'vm functions',
{
    instantiateClassindexableSize: function(aClass, indexableSize) {
        return this.vm.instantiateClass(aClass, indexableSize);
    },
    methodArgumentCount: function() {
        return this.argCount;
    },
    makePointwithxValueyValue: function(x, y) {
        return this.vm.primHandler.makePointWithXandY(x, y);
    },
    pushRemappableOop: function(obj) {
        this.remappableOops.push(obj);
    },
    popRemappableOop: function() {
        return this.remappableOops.pop();
    },
    showDisplayBitsLeftTopRightBottom: function(form, left, top, right, bottom) {
        if (left < right && top < bottom) {
            var rect = {left: left, top: top, right: right, bottom: bottom};
            this.vm.primHandler.displayDirty(form, rect);
        }
    },
    ioLoadFunctionFrom: function(funcName, pluginName) {
        return this.vm.primHandler.loadFunctionFrom(funcName, pluginName);
    },
});
