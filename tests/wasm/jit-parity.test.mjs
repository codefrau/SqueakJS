import assert from "assert";

if (!globalThis.Squeak) globalThis.Squeak = {};

const {
    getExecutionBackendForVM,
    configureExecutionBackendForVM,
    invokeIntegerBinaryOpAccelerator,
    binarySeriesOpSync,
} = await import("../../vm.execution.js");

const {
    getWasmPrototypeInstance,
    binaryIntOpSync,
    binaryCompareOpSync,
} = await import("../../vm.interpreter.wasm.js");

class FakeVM {
    constructor(options = {}) {
        this.options = options;
        this.image = options.image || {
            writeToBuffer() { return new ArrayBuffer(0); },
        };
        this.calls = [];
        this.warnLog = [];
    }

    _interpretSliceJS(forMilliseconds, thenDo) {
        this.calls.push({ forMilliseconds, thenDo });
        if (typeof thenDo === "function") thenDo(0);
        return 0;
    }

    warnOnce(message) {
        this.warnLog.push(String(message));
    }
}

const wasmVM = new FakeVM({ executionBackend: "wasm-prototype" });
const backend = getExecutionBackendForVM(wasmVM);
assert.strictEqual(backend.name, "wasm-prototype", "should select wasm backend");
await getWasmPrototypeInstance();

const add = invokeIntegerBinaryOpAccelerator(wasmVM, {
    primitiveIndex: 1,
    lhs: 12,
    rhs: 30,
    type: "int",
    kind: "smallint-primitive",
});
assert.ok(add && add.handled, "addition accelerator should respond");
assert.strictEqual(add.value, 42, "accelerated addition should be correct");

const less = invokeIntegerBinaryOpAccelerator(wasmVM, {
    primitiveIndex: 3,
    lhs: 2,
    rhs: 5,
    type: "bool",
    kind: "smallint-primitive",
});
assert.ok(less && less.handled, "comparison accelerator should respond");
assert.strictEqual(less.value, true, "accelerated comparison should be true");

const equalFalse = invokeIntegerBinaryOpAccelerator(wasmVM, {
    primitiveIndex: 7,
    lhs: 5,
    rhs: 9,
    type: "bool",
    kind: "smallint-primitive",
});
assert.ok(equalFalse && equalFalse.handled, "equality accelerator should respond");
assert.strictEqual(equalFalse.value, false, "accelerated equality should be false");

const unsupported = invokeIntegerBinaryOpAccelerator(wasmVM, {
    primitiveIndex: 18,
    lhs: 1,
    rhs: 2,
    type: "int",
    kind: "smallint-primitive",
});
assert.strictEqual(unsupported, null, "unsupported primitive should fall back");

const directAdd = binaryIntOpSync(0, 7, 5);
assert.strictEqual(directAdd, 12, "direct wasm addition should work");
const directCompare = binaryCompareOpSync(4, 9, 9);
assert.strictEqual(directCompare, 1, "direct wasm equality should return 1");

const iterations = 200000;

function measure(fn) {
    const start = process.hrtime.bigint();
    const value = fn();
    const durationNs = Number(process.hrtime.bigint() - start);
    return { value, durationMs: durationNs / 1e6 };
}

const wasmSeries = measure(() => binarySeriesOpSync(0, 3, 5, iterations));
let jsSeriesValue = 0;
const jsSeries = measure(() => {
    let acc = 0;
    for (let i = 0; i < iterations; i++) {
        const lhs = 3 + i;
        const rhs = 5 + i;
        acc ^= (lhs + rhs) | 0;
    }
    jsSeriesValue = acc;
    return acc;
});

assert.strictEqual(wasmSeries.value | 0, jsSeriesValue | 0, "series xor results should match");
assert.ok(jsSeries.durationMs >= wasmSeries.durationMs * 1.3,
    `expected wasm series to be at least 30% faster (js=${jsSeries.durationMs.toFixed(3)}ms wasm=${wasmSeries.durationMs.toFixed(3)}ms)`);

configureExecutionBackendForVM(wasmVM, "js-interpreter");
const fallback = invokeIntegerBinaryOpAccelerator(wasmVM, {
    primitiveIndex: 1,
    lhs: 1,
    rhs: 1,
    type: "int",
    kind: "smallint-primitive",
});
assert.strictEqual(fallback, null, "accelerator should be cleared when switching backends");

console.log("wasmSeries", wasmSeries);
console.log("jsSeries", jsSeries);
