#!/usr/bin/env node
"use strict";

const assert = require("assert");

global.self = global;

require("../../globals.js");
require("../../vm.js");
require("../../vm.object.js");
require("../../vm.interpreter.proxy.js");
require("../../vm.primitives.js");

const nilObj = new Squeak.Object();
nilObj.isNil = true;
nilObj.pointers = [];
nilObj._format = 0;
nilObj.sqClass = null;

function makeClass(superclass) {
    const cls = new Squeak.Object();
    cls.isNil = false;
    cls.pointers = [];
    cls.pointers[Squeak.Class_superclass] = superclass || nilObj;
    cls.pointers[Squeak.Class_format] = 0;
    cls._format = 0;
    cls.classInstSize = function() { return 0; };
    return cls;
}

const objectClass = makeClass(nilObj);
const stringClass = makeClass(objectClass);
const byteStringClass = makeClass(stringClass);
const wideStringClass = makeClass(stringClass);
const characterClass = makeClass(objectClass);

const specialObjects = [];
specialObjects[Squeak.splOb_ClassString] = stringClass;
specialObjects[Squeak.splOb_ClassCharacter] = characterClass;
specialObjects[Squeak.splOb_CharacterTable] = { pointers: [] };

const vm = {
    stack: [],
    image: {
        hasClosures: true,
        isSpur: false,
        bytesLeft: () => Number.MAX_SAFE_INTEGER,
    },
    specialObjects: specialObjects,
    nilObj: nilObj,
    trueObj: { isTrue: true },
    falseObj: { isFalse: true },
    verifyAtSelector: null,
    verifyAtClass: null,
    specialSelectors: [],
    stackValue(n) {
        return this.stack[this.stack.length - 1 - n];
    },
    top() {
        return this.stack[this.stack.length - 1];
    },
    push(value) {
        this.stack.push(value);
    },
    pop() {
        return this.stack.pop();
    },
    popNandPush(nToPop, value) {
        this.stack.splice(this.stack.length - nToPop, nToPop, value);
    },
    canBeSmallInt(value) {
        return typeof value === "number" && value >= Squeak.MinSmallInt && value <= Squeak.MaxSmallInt;
    },
    instantiateClass(cls, indexableSize) {
        const inst = new Squeak.Object();
        inst.sqClass = cls;
        inst.isNil = false;
        inst._format = 0;
        inst.pointers = new Array(indexableSize);
        for (let i = 0; i < indexableSize; i++) inst.pointers[i] = this.nilObj;
        return inst;
    },
    isContext() {
        return false;
    },
};

const primitives = new Squeak.Primitives(vm, null);
primitives.charFromInt = function(codePoint) {
    return { isCharacter: true, codePoint: codePoint, sqClass: characterClass };
};
primitives.charToInt = function(character) {
    return character.codePoint;
};

function makeByteString(bytes) {
    const obj = new Squeak.Object();
    obj.sqClass = byteStringClass;
    obj.isNil = false;
    obj._format = 8;
    obj.bytes = new Uint8Array(bytes);
    obj.pointers = [];
    obj.hash = 1;
    return obj;
}

function makeWideString(codePoints) {
    const obj = new Squeak.Object();
    obj.sqClass = wideStringClass;
    obj.isNil = false;
    obj._format = 6;
    obj.words = new Uint32Array(codePoints);
    obj.pointers = [];
    obj.hash = 2;
    return obj;
}

function makeStream(collection) {
    const stream = new Squeak.Object();
    stream.sqClass = objectClass;
    stream.isNil = false;
    stream._format = 0;
    stream.pointers = [];
    stream.pointers[Squeak.Stream_array] = collection;
    stream.pointers[Squeak.Stream_position] = 0;
    let limit = 0;
    if (collection.isBytes && collection.isBytes()) limit = collection.bytes.length;
    else if (collection.isWords && collection.isWords()) limit = collection.words.length;
    else if (collection.pointers) limit = collection.pointers.length;
    stream.pointers[Squeak.Stream_limit] = limit;
    return stream;
}

function runPrimitive(index, argCount) {
    primitives.success = true;
    return primitives.doPrimitive(index, argCount);
}

(function testByteStringReadReturnsCharacter() {
    const byteString = makeByteString([65, 66]);
    const stream = makeStream(byteString);
    vm.stack = [stream];
    assert.strictEqual(runPrimitive(65, 0), true, "primitiveNext should succeed for ByteString");
    const result = vm.stack[0];
    assert.ok(result && result.isCharacter, "ByteString next should produce a Character");
    assert.strictEqual(result.codePoint, 65, "Character code should match first byte");
    assert.strictEqual(stream.pointers[Squeak.Stream_position], 1, "Stream position should advance by one");
})();

(function testByteStringWriteRequiresCharacter() {
    const byteString = makeByteString([0, 0]);
    const stream = makeStream(byteString);
    const character = primitives.charFromInt(90);
    vm.stack = [stream, character];
    assert.strictEqual(runPrimitive(66, 1), true, "primitiveNextPut: should accept Character for ByteString");
    assert.strictEqual(vm.stack[0], character, "nextPut: should answer the argument");
    assert.strictEqual(byteString.bytes[0], 90, "ByteString should store the character code");
    assert.strictEqual(stream.pointers[Squeak.Stream_position], 1, "Stream position should advance");

    const rejected = makeStream(makeByteString([0]));
    vm.stack = [rejected, 65];
    assert.strictEqual(runPrimitive(66, 1), false, "primitiveNextPut: should reject SmallInteger for textual ByteString");
    assert.strictEqual(rejected.pointers[Squeak.Stream_position], 0, "Position should not advance on failure");
})();

(function testWideStringReadAndWriteCharacters() {
    const smile = 0x1F642;
    const wideString = makeWideString([smile]);
    const stream = makeStream(wideString);
    vm.stack = [stream];
    assert.strictEqual(runPrimitive(65, 0), true, "primitiveNext should succeed for WideString");
    const result = vm.stack[0];
    assert.ok(result && result.isCharacter, "WideString next should produce a Character");
    assert.strictEqual(result.codePoint, smile, "WideString next should yield Unicode code point");
    assert.strictEqual(stream.pointers[Squeak.Stream_position], 1, "WideString read should advance position");

    const euro = 0x20AC;
    const writable = makeWideString([0]);
    const writeStream = makeStream(writable);
    const euroChar = primitives.charFromInt(euro);
    vm.stack = [writeStream, euroChar];
    assert.strictEqual(runPrimitive(66, 1), true, "primitiveNextPut: should accept Character for WideString");
    assert.strictEqual(writable.words[0], euro, "WideString should store full Unicode code point");
    assert.strictEqual(writeStream.pointers[Squeak.Stream_position], 1, "WideString write should advance position");

    const rejectWide = makeStream(makeWideString([0]));
    vm.stack = [rejectWide, euro];
    assert.strictEqual(runPrimitive(66, 1), false, "primitiveNextPut: should reject integers for WideString");
    assert.strictEqual(rejectWide.pointers[Squeak.Stream_position], 0, "WideString position should remain when write rejected");
})();

console.log("Stream coercion tests passed.");
