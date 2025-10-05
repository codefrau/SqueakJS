import test from "node:test";
import assert from "node:assert/strict";

import {
    configureExecutionBackendForVM,
    getExecutionBackendForVM,
} from "../../vm.execution.js";
import {
    ensureSharedHeapForVM,
    getSharedHeapForVM,
    markSharedHeapDirty,
    sharedHeapIsShared,
} from "../../vm.execution.state.js";

function createFakeImage(byteLength) {
    return {
        seed: 0,
        writes: 0,
        writeToBuffer() {
            this.writes++;
            const buffer = new ArrayBuffer(byteLength);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < view.length; i++) {
                view[i] = (this.seed + i) & 0xFF;
            }
            return buffer;
        },
    };
}

function createFakeVM(byteLength) {
    const image = createFakeImage(byteLength);
    return {
        image,
        options: {},
        _interpretSliceJS(forMilliseconds, thenDo) {
            this.ticks = (this.ticks || 0) + 1;
            this.image.seed = (this.image.seed + 1) & 0xFF;
            markSharedHeapDirty(this);
            if (thenDo) thenDo(0);
            return 0;
        },
    };
}

test("shared heap prefers SharedArrayBuffer when available", () => {
    const vm = createFakeVM(64);
    configureExecutionBackendForVM(vm);
    const heap = ensureSharedHeapForVM(vm, { preferShared: true, forceSync: true });
    assert.equal(heap.byteLength, 64);
    if (typeof SharedArrayBuffer === "function") {
        assert.ok(heap.shared, "expected shared heap to use SharedArrayBuffer");
    } else {
        assert.equal(heap.shared, false);
    }
    assert.strictEqual(getSharedHeapForVM(vm), heap);
});

test("shared heap falls back when shared buffers are disabled", () => {
    const vm = createFakeVM(32);
    configureExecutionBackendForVM(vm);
    const heap = ensureSharedHeapForVM(vm, { preferShared: false, forceSync: true });
    assert.equal(heap.byteLength, 32);
    assert.equal(heap.shared, false, "expected ArrayBuffer fallback when preferShared is false");
});

test("backend swaps keep shared heap synchronised", () => {
    const vm = createFakeVM(48);
    configureExecutionBackendForVM(vm);
    let heap = ensureSharedHeapForVM(vm, { forceSync: true });
    const baseline = heap.bytes[0];
    const jsBackend = getExecutionBackendForVM(vm);
    jsBackend.interpret(1);
    heap = ensureSharedHeapForVM(vm, { forceSync: true });
    assert.notEqual(heap.bytes[0], baseline, "JS slice should update shared heap snapshot");
    const jsVersion = heap.version;
    configureExecutionBackendForVM(vm, "wasm-prototype");
    const wasmBackend = getExecutionBackendForVM(vm);
    wasmBackend.interpret(1);
    heap = ensureSharedHeapForVM(vm, { forceSync: true });
    assert.ok(heap.version > jsVersion, "wasm run should advance heap version after sync");
    assert.equal(sharedHeapIsShared(vm), typeof SharedArrayBuffer === "function");
});
