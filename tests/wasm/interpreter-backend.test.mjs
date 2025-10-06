import test from "node:test";
import assert from "node:assert/strict";

import {
    createPrototypeInterpreterHarness,
    getWasmPrototypeOpcodes,
    getWasmPrototypeLayout,
} from "../../vm.interpreter.wasm.js";
import {
    configureExecutionBackendForVM,
    getExecutionBackendForVM,
} from "../../vm.execution.js";

function createProgram(bytes) {
    return Uint8Array.from(bytes);
}

function encodeInt32(value) {
    const v = value | 0;
    return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

function createFakeVM(imageSize) {
    const imageBuffer = new ArrayBuffer(imageSize);
    return {
        options: {},
        image: {
            writes: 0,
            writeToBuffer() {
                this.writes++;
                return imageBuffer.slice(0);
            },
        },
        _interpretSliceJS(forMilliseconds, thenDo) {
            this.slices = (this.slices || 0) + 1;
            if (thenDo) thenDo(0);
            return 0;
        },
        _bytecodeQueue: [],
        enqueueSlice(slice) {
            this._bytecodeQueue.push(slice);
        },
        dequeueWasmPrototypeSlice() {
            return this._bytecodeQueue.shift() || null;
        },
    };
}

const OPCODES = getWasmPrototypeOpcodes();
const LAYOUT = getWasmPrototypeLayout();

test("prototype harness executes stack program", () => {
    const harness = createPrototypeInterpreterHarness({
        contextOffset: 0,
        bytecodeOffset: 64,
        bytecodeCapacity: 256,
        stackOffset: 1024,
        stackCapacity: 32,
    });
    const program = createProgram([
        OPCODES.PUSH_INT8, 5,
        OPCODES.PUSH_INT32, ...encodeInt32(7),
        OPCODES.PRIMITIVE_CALL, 0,
        OPCODES.PUSH_INT8, 3,
        OPCODES.MUL,
        OPCODES.HALT,
    ]);
    harness.resetContext({
        pc: harness.layout.bytecodeOffset,
        stackBase: harness.layout.stackOffset,
        limit: program.length,
    });
    harness.loadStack([]);
    harness.setBytecodes(program);
    const result = harness.run(program.length);
    assert.equal(result.result, 36, "expected arithmetic chain to produce 36");
    assert.equal(result.context.pc, harness.layout.bytecodeOffset + program.length, "pc should advance past program");
    assert.equal(result.context.stackTop - result.context.stackBase, 4, "one value should remain on stack");
    assert.equal(harness.stackView[0], 36);
    assert.equal(result.context.limit, 0, "halt should exhaust budget");
});

test("primitive dispatch validates table bounds", () => {
    const harness = createPrototypeInterpreterHarness({
        contextOffset: 0,
        bytecodeOffset: 64,
        bytecodeCapacity: 64,
        stackOffset: 512,
        stackCapacity: 16,
    });
    const program = createProgram([
        OPCODES.PUSH_INT8, 42,
        OPCODES.PUSH_INT32, ...encodeInt32(42),
        OPCODES.PRIMITIVE_CALL, 7,
        OPCODES.HALT,
    ]);
    harness.resetContext({ limit: program.length });
    harness.loadStack([]);
    harness.setBytecodes(program);
    const success = harness.run(program.length);
    assert.equal(success.result, 1, "equality primitive should return 1 for identical values");

    const badProgram = createProgram([
        OPCODES.PUSH_INT8, 1,
        OPCODES.PUSH_INT8, 2,
        OPCODES.PRIMITIVE_CALL, 31,
        OPCODES.HALT,
    ]);
    harness.resetContext({ limit: badProgram.length });
    harness.loadStack([]);
    harness.setBytecodes(badProgram);
    const failure = harness.run(badProgram.length);
    assert.equal(failure.result, 0, "invalid primitive should return default value");
    assert.equal(failure.context.limit, 0, "invalid primitive should zero the budget");
});

test("wasm backend executes queued bytecode slices", () => {
    const vm = createFakeVM(128);
    configureExecutionBackendForVM(vm, "wasm-prototype");
    const backend = getExecutionBackendForVM(vm, "wasm-prototype");
    const sliceProgram = createProgram([
        OPCODES.PUSH_INT8, 6,
        OPCODES.PUSH_INT32, ...encodeInt32(4),
        OPCODES.PRIMITIVE_CALL, 0,
        OPCODES.PUSH_INT8, 2,
        OPCODES.MUL,
        OPCODES.HALT,
    ]);
    const slice = {
        bytecodes: sliceProgram,
        limit: sliceProgram.length,
        stack: [],
    };
    const execution = backend.executeBytecodeSlice(slice);
    assert.equal(execution.result, 20);
    assert.equal(execution.context.stackTop - execution.context.stackBase, 4);
    assert.equal(execution.stack[0], 20);

    vm.enqueueSlice({ bytecodes: sliceProgram, limit: sliceProgram.length });
    backend.interpret(1);
    assert.equal(vm._bytecodeQueue.length, 0, "interpret should drain queued slices");
    const description = backend.describe();
    assert.equal(description.name, "wasm-prototype");
    assert.ok(description.harness, "describe() should expose harness layout");
    assert.ok(description.opcodes);
    assert.ok(description.primitives);
    assert.ok(description.lastExecution);
    assert.equal(description.harness.layout.contextSize, LAYOUT.contextSize);
});
