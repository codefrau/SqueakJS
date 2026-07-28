"use strict";
// Synthetic microbenchmark mimicking the shape of SqueakJS's hot loop as measured
// in the CPU profile: findSelectorInClass (linear-probe method dict lookup),
// executeNewMethod (context allocation from a recycle pool, arg copy, temp nil-fill),
// doReturn (context recycling). Not a real Smalltalk interpreter -- just the same
// data-structure shapes and control flow, run recursively via a fib(n) send tree
// so we get millions of sends of a realistic shape.

function makeMethodDict(entries) {
    var size = 1;
    while (size < entries.length * 4) size *= 2; // keep load factor low, like a real MethodDict
    var selectors = new Array(size).fill(-1); // -1 == nil
    var methods = new Array(size).fill(-1);
    var mask = size - 1;
    for (var i = 0; i < entries.length; i++) {
        var sel = entries[i][0], meth = entries[i][1];
        var idx = sel & mask;
        while (selectors[idx] !== -1) idx = (idx + 1) & mask;
        selectors[idx] = sel;
        methods[idx] = meth;
    }
    return { selectors: selectors, methods: methods, mask: mask };
}

function lookupSelectorInDict(mDict, selectorHash) {
    var idx = selectorHash & mDict.mask;
    while (true) {
        if (mDict.selectors[idx] === selectorHash) return mDict.methods[idx];
        if (mDict.selectors[idx] === -1) return -1; // nil
        idx = (idx + 1) & mDict.mask;
    }
}

var SEL_FIB = 1;
var METH_FIB = 100;
var fibClassDict = makeMethodDict([[SEL_FIB, METH_FIB]]);

var FRAME_SIZE = 8; // sender + arg + temps, like Squeak's Context_tempFrameStart layout
var freeList = [];
var sendCount = 0;

function allocateContext() {
    var ctx = freeList.pop();
    if (!ctx) ctx = { pointers: new Array(FRAME_SIZE) };
    return ctx;
}
function recycleContext(ctx) {
    freeList.push(ctx);
}

function executeNewMethod(senderCtx, arg) {
    sendCount++;
    var found = lookupSelectorInDict(fibClassDict, SEL_FIB); // findSelectorInClass equivalent
    if (found !== METH_FIB) throw new Error("lookup failed");
    var ctx = allocateContext();
    ctx.sender = senderCtx;
    ctx.pointers[0] = arg;
    ctx.pointers[1] = 0;
    for (var i = 2; i < FRAME_SIZE; i++) ctx.pointers[i] = null; // fill temps with nil
    return ctx;
}

function doReturn(ctx) {
    var sender = ctx.sender;
    recycleContext(ctx);
    return sender;
}

function fibSend(senderCtx, n) {
    var ctx = executeNewMethod(senderCtx, n);
    var result;
    if (n < 2) {
        result = n;
    } else {
        var a = fibSend(ctx, n - 1);
        var b = fibSend(ctx, n - 2);
        result = a + b;
    }
    doReturn(ctx);
    return result;
}

module.exports = function run(n) {
    sendCount = 0;
    freeList.length = 0;
    var t0 = process.hrtime.bigint();
    var result = fibSend(null, n);
    var t1 = process.hrtime.bigint();
    return { result: result, sends: sendCount, ns: Number(t1 - t0) };
};
