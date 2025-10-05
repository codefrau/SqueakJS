"use strict";

import {
    setEmbeddedWasmPrototypeBinary,
    loadWasmPrototypeBinary,
    getWasmPrototypeStreamingResponse,
} from "./vm.execution.assets.js";

const wasmPrototypeWat = `(module
  (func $runLoop (export "runLoop") (param $iterations i32) (result i32)
    (local $i i32)
    (local $acc i32)
    (local.set $i (i32.const 0))
    (local.set $acc (i32.const 0))
    (block $exit
      (loop $loop
        (br_if $exit (i32.ge_u (local.get $i) (local.get $iterations)))
        (local.set $acc
          (i32.xor
            (i32.add (local.get $acc) (i32.and (local.get $i) (i32.const 255)))
            (i32.shl (local.get $acc) (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    (local.get $acc))
  (func $binaryIntOp (export "binaryIntOp") (param $op i32) (param $lhs i32) (param $rhs i32) (result i32)
    (if (result i32) (i32.eq (local.get $op) (i32.const 0))
      (then (i32.add (local.get $lhs) (local.get $rhs)))
      (else
        (if (result i32) (i32.eq (local.get $op) (i32.const 1))
          (then (i32.sub (local.get $lhs) (local.get $rhs)))
          (else
            (if (result i32) (i32.eq (local.get $op) (i32.const 2))
              (then (i32.mul (local.get $lhs) (local.get $rhs)))
              (else (i32.const 0))))))))
  (func $binaryCompareOp (export "binaryCompareOp") (param $op i32) (param $lhs i32) (param $rhs i32) (result i32)
    (if (result i32) (i32.eq (local.get $op) (i32.const 0))
      (then (i32.lt_s (local.get $lhs) (local.get $rhs)))
      (else
        (if (result i32) (i32.eq (local.get $op) (i32.const 1))
          (then (i32.gt_s (local.get $lhs) (local.get $rhs)))
          (else
            (if (result i32) (i32.eq (local.get $op) (i32.const 2))
              (then (i32.le_s (local.get $lhs) (local.get $rhs)))
              (else
                (if (result i32) (i32.eq (local.get $op) (i32.const 3))
                  (then (i32.ge_s (local.get $lhs) (local.get $rhs)))
                  (else
                    (if (result i32) (i32.eq (local.get $op) (i32.const 4))
                      (then (i32.eq (local.get $lhs) (local.get $rhs)))
                      (else
                        (if (result i32) (i32.eq (local.get $op) (i32.const 5))
                          (then (i32.ne (local.get $lhs) (local.get $rhs)))
                          (else (i32.const 0)))))))))))))
  (func $binarySeriesOp (export "binarySeriesOp")
      (param $op i32) (param $lhs i32) (param $rhs i32) (param $iterations i32) (result i32)
    (local $i i32)
    (local $acc i32)
    (local $currentL i32)
    (local $currentR i32)
    (local $result i32)
    (local.set $i (i32.const 0))
    (local.set $acc (i32.const 0))
    (block $exit
      (loop $loop
        (br_if $exit (i32.ge_u (local.get $i) (local.get $iterations)))
        (local.set $currentL (i32.add (local.get $lhs) (local.get $i)))
        (local.set $currentR (i32.add (local.get $rhs) (local.get $i)))
        (local.set $result
          (if (result i32) (i32.eq (local.get $op) (i32.const 0))
            (then (i32.add (local.get $currentL) (local.get $currentR)))
            (else
              (if (result i32) (i32.eq (local.get $op) (i32.const 1))
                (then (i32.sub (local.get $currentL) (local.get $currentR)))
                (else
                  (if (result i32) (i32.eq (local.get $op) (i32.const 2))
                    (then (i32.mul (local.get $currentL) (local.get $currentR)))
                    (else (i32.const 0))))))))
        (local.set $acc (i32.xor (local.get $acc) (local.get $result)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    (local.get $acc)))`;

const wasmPrototypeBinary = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 
    0x01, 0x15, 0x03, 0x60, 0x01, 0x7f, 0x01, 0x7f, 
    0x60, 0x03, 0x7f, 0x7f, 0x7f, 0x01, 0x7f, 0x60, 
    0x04, 0x7f, 0x7f, 0x7f, 0x7f, 0x01, 0x7f, 0x03, 
    0x05, 0x04, 0x00, 0x01, 0x01, 0x02, 0x07, 0x3c, 
    0x04, 0x07, 0x72, 0x75, 0x6e, 0x4c, 0x6f, 0x6f, 
    0x70, 0x00, 0x00, 0x0b, 0x62, 0x69, 0x6e, 0x61, 
    0x72, 0x79, 0x49, 0x6e, 0x74, 0x4f, 0x70, 0x00, 
    0x01, 0x0f, 0x62, 0x69, 0x6e, 0x61, 0x72, 0x79, 
    0x43, 0x6f, 0x6d, 0x70, 0x61, 0x72, 0x65, 0x4f, 
    0x70, 0x00, 0x02, 0x0e, 0x62, 0x69, 0x6e, 0x61, 
    0x72, 0x79, 0x53, 0x65, 0x72, 0x69, 0x65, 0x73, 
    0x4f, 0x70, 0x00, 0x03, 0x0a, 0xa7, 0x02, 0x04, 
    0x35, 0x01, 0x02, 0x7f, 0x41, 0x00, 0x21, 0x01, 
    0x41, 0x00, 0x21, 0x02, 0x02, 0x40, 0x03, 0x40, 
    0x20, 0x01, 0x20, 0x00, 0x4f, 0x0d, 0x01, 0x20, 
    0x02, 0x20, 0x01, 0x41, 0xff, 0x01, 0x71, 0x6a, 
    0x20, 0x02, 0x41, 0x01, 0x74, 0x73, 0x21, 0x02, 
    0x20, 0x01, 0x41, 0x01, 0x6a, 0x21, 0x01, 0x0c, 
    0x00, 0x0b, 0x0b, 0x20, 0x02, 0x0b, 0x2e, 0x00, 
    0x20, 0x00, 0x41, 0x00, 0x46, 0x04, 0x7f, 0x20, 
    0x01, 0x20, 0x02, 0x6a, 0x05, 0x20, 0x00, 0x41, 
    0x01, 0x46, 0x04, 0x7f, 0x20, 0x01, 0x20, 0x02, 
    0x6b, 0x05, 0x20, 0x00, 0x41, 0x02, 0x46, 0x04, 
    0x7f, 0x20, 0x01, 0x20, 0x02, 0x6c, 0x05, 0x41, 
    0x00, 0x0b, 0x0b, 0x0b, 0x0b, 0x58, 0x00, 0x20, 
    0x00, 0x41, 0x00, 0x46, 0x04, 0x7f, 0x20, 0x01, 
    0x20, 0x02, 0x48, 0x05, 0x20, 0x00, 0x41, 0x01, 
    0x46, 0x04, 0x7f, 0x20, 0x01, 0x20, 0x02, 0x4a, 
    0x05, 0x20, 0x00, 0x41, 0x02, 0x46, 0x04, 0x7f, 
    0x20, 0x01, 0x20, 0x02, 0x4c, 0x05, 0x20, 0x00, 
    0x41, 0x03, 0x46, 0x04, 0x7f, 0x20, 0x01, 0x20, 
    0x02, 0x4e, 0x05, 0x20, 0x00, 0x41, 0x04, 0x46, 
    0x04, 0x7f, 0x20, 0x01, 0x20, 0x02, 0x46, 0x05, 
    0x20, 0x00, 0x41, 0x05, 0x46, 0x04, 0x7f, 0x20, 
    0x01, 0x20, 0x02, 0x47, 0x05, 0x41, 0x00, 0x0b, 
    0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x67, 0x01, 
    0x05, 0x7f, 0x41, 0x00, 0x21, 0x04, 0x41, 0x00, 
    0x21, 0x05, 0x02, 0x40, 0x03, 0x40, 0x20, 0x04, 
    0x20, 0x03, 0x4f, 0x0d, 0x01, 0x20, 0x01, 0x20, 
    0x04, 0x6a, 0x21, 0x06, 0x20, 0x02, 0x20, 0x04, 
    0x6a, 0x21, 0x07, 0x20, 0x00, 0x41, 0x00, 0x46, 
    0x04, 0x7f, 0x20, 0x06, 0x20, 0x07, 0x6a, 0x05, 
    0x20, 0x00, 0x41, 0x01, 0x46, 0x04, 0x7f, 0x20, 
    0x06, 0x20, 0x07, 0x6b, 0x05, 0x20, 0x00, 0x41, 
    0x02, 0x46, 0x04, 0x7f, 0x20, 0x06, 0x20, 0x07, 
    0x6c, 0x05, 0x41, 0x00, 0x0b, 0x0b, 0x0b, 0x21, 
    0x08, 0x20, 0x05, 0x20, 0x08, 0x73, 0x21, 0x05, 
    0x20, 0x04, 0x41, 0x01, 0x6a, 0x21, 0x04, 0x0c,
    0x00, 0x0b, 0x0b, 0x20, 0x05, 0x0b
]);

setEmbeddedWasmPrototypeBinary(wasmPrototypeBinary);

let instantiatePromise = null;
let cachedInstance = null;

function normalizeInstantiateResult(result) {
    if (!result) return null;
    if (result.instance && result.module) {
        return { module: result.module, exports: result.instance.exports };
    }
    if (typeof WebAssembly === "object" && typeof WebAssembly.Instance === "function" && result instanceof WebAssembly.Instance) {
        return { module: null, exports: result.exports };
    }
    if (result.exports) {
        return { module: result.module || null, exports: result.exports };
    }
    return null;
}

async function instantiateFromBinary(env, binary) {
    const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    if (typeof WebAssembly.Module === "function" && typeof WebAssembly.Instance === "function") {
        try {
            const module = new WebAssembly.Module(bytes);
            const instance = new WebAssembly.Instance(module, env);
            return { module, exports: instance.exports };
        } catch (_) {
            // fall back to instantiate
        }
    }
    if (typeof WebAssembly.instantiate !== "function") {
        throw new Error("WebAssembly.instantiate is not available in this environment");
    }
    const instantiated = await WebAssembly.instantiate(bytes, env);
    return normalizeInstantiateResult(instantiated);
}

async function tryInstantiateStreaming(env) {
    const streamingSource = await getWasmPrototypeStreamingResponse();
    if (!streamingSource) return null;
    try {
        const instantiated = await WebAssembly.instantiateStreaming(streamingSource.response, env);
        return normalizeInstantiateResult(instantiated);
    } catch (_) {
        if (streamingSource.binary) {
            try {
                return await instantiateFromBinary(env, streamingSource.binary);
            } catch (error) {
                throw error;
            }
        }
        return null;
    }
}

function instantiatePrototype(imports) {
    if (cachedInstance) {
        if (!instantiatePromise) {
            instantiatePromise = Promise.resolve(cachedInstance);
        }
        return instantiatePromise;
    }
    if (instantiatePromise) {
        return instantiatePromise;
    }
    if (typeof WebAssembly !== "object") {
        const error = new Error("WebAssembly is not available in this environment");
        instantiatePromise = Promise.reject(error);
        return instantiatePromise;
    }
    const env = imports || {};
    instantiatePromise = (async function instantiate() {
        try {
            const streaming = await tryInstantiateStreaming(env);
            if (streaming) {
                cachedInstance = streaming;
                return streaming;
            }
            const binary = await loadWasmPrototypeBinary();
            const instantiated = await instantiateFromBinary(env, binary);
            cachedInstance = instantiated;
            return instantiated;
        } catch (error) {
            cachedInstance = null;
            throw error;
        }
    })().finally(function() {
        instantiatePromise = null;
    });
    return instantiatePromise;
}

function getCachedExports() {
    return cachedInstance ? cachedInstance.exports : null;
}

export function ensureWasmPrototypeInstance(imports) {
    if (cachedInstance) return cachedInstance.exports;
    instantiatePrototype(imports).catch(function() {});
    return getCachedExports();
}

export async function getWasmPrototypeInstance(imports) {
    const instantiated = await instantiatePrototype(imports);
    return instantiated.exports;
}

function callExport(fn, fallback) {
    try {
        if (typeof fn === "function") return fn();
    } catch (_) {
        return fallback;
    }
    return fallback;
}

export function runPrototypeLoopSync(iterations) {
    const exports = ensureWasmPrototypeInstance();
    if (!exports || typeof exports.runLoop !== "function") return null;
    const count = (iterations == null ? 0 : iterations) >>> 0;
    return exports.runLoop(count >>> 0);
}

export async function runPrototypeLoop(iterations) {
    const exports = await getWasmPrototypeInstance();
    if (typeof exports.runLoop !== "function") {
        throw new Error("WASM prototype does not expose runLoop");
    }
    const count = (iterations == null ? 0 : iterations) >>> 0;
    return exports.runLoop(count >>> 0);
}

export function binaryIntOpSync(op, lhs, rhs) {
    const exports = ensureWasmPrototypeInstance();
    if (!exports || typeof exports.binaryIntOp !== "function") return null;
    return exports.binaryIntOp(op >>> 0, lhs | 0, rhs | 0) | 0;
}

export function binaryCompareOpSync(op, lhs, rhs) {
    const exports = ensureWasmPrototypeInstance();
    if (!exports || typeof exports.binaryCompareOp !== "function") return null;
    return exports.binaryCompareOp(op >>> 0, lhs | 0, rhs | 0) | 0;
}

export function binarySeriesOpSync(op, lhs, rhs, iterations) {
    const exports = ensureWasmPrototypeInstance();
    if (!exports || typeof exports.binarySeriesOp !== "function") return null;
    return exports.binarySeriesOp(op >>> 0, lhs | 0, rhs | 0, iterations >>> 0) | 0;
}

export async function runBinaryIntOp(op, lhs, rhs) {
    const exports = await getWasmPrototypeInstance();
    if (typeof exports.binaryIntOp !== "function") {
        throw new Error("WASM prototype does not expose binaryIntOp");
    }
    return exports.binaryIntOp(op >>> 0, lhs | 0, rhs | 0) | 0;
}

export async function runBinaryCompareOp(op, lhs, rhs) {
    const exports = await getWasmPrototypeInstance();
    if (typeof exports.binaryCompareOp !== "function") {
        throw new Error("WASM prototype does not expose binaryCompareOp");
    }
    return exports.binaryCompareOp(op >>> 0, lhs | 0, rhs | 0) | 0;
}

export async function runBinarySeriesOp(op, lhs, rhs, iterations) {
    const exports = await getWasmPrototypeInstance();
    if (typeof exports.binarySeriesOp !== "function") {
        throw new Error("WASM prototype does not expose binarySeriesOp");
    }
    return exports.binarySeriesOp(op >>> 0, lhs | 0, rhs | 0, iterations >>> 0) | 0;
}

export function getWasmPrototypeBinary() {
    return wasmPrototypeBinary.slice();
}

export function getWasmPrototypeWat() {
    return wasmPrototypeWat;
}

export function resetWasmPrototypeInstance() {
    instantiatePromise = null;
    cachedInstance = null;
}

if (typeof globalThis === "object") {
    if (!globalThis.Squeak) globalThis.Squeak = {};
    if (!globalThis.Squeak.experimental) globalThis.Squeak.experimental = {};
    globalThis.Squeak.experimental.wasmPrototype = {
        get binary() { return getWasmPrototypeBinary(); },
        get wat() { return getWasmPrototypeWat(); },
        runLoop: runPrototypeLoop,
        runLoopSync: runPrototypeLoopSync,
        binaryIntOp: runBinaryIntOp,
        binaryCompareOp: runBinaryCompareOp,
        binarySeriesOp: runBinarySeriesOp,
        reset: resetWasmPrototypeInstance,
    };
}

export const wasmPrototypeMetadata = Object.freeze({
    name: "interpreter-hotspot-prototype",
    description: "Prototype loop plus integer primitive accelerators translated to WebAssembly",
    instructions: 112,
    locals: 7,
    exports: ["runLoop", "binaryIntOp", "binaryCompareOp", "binarySeriesOp"],
});

export default {
    ensureWasmPrototypeInstance,
    getWasmPrototypeInstance,
    runPrototypeLoop,
    runPrototypeLoopSync,
    runBinaryIntOp,
    runBinaryCompareOp,
    runBinarySeriesOp,
    binaryIntOpSync,
    binaryCompareOpSync,
    binarySeriesOpSync,
    getWasmPrototypeBinary,
    getWasmPrototypeWat,
    resetWasmPrototypeInstance,
    metadata: wasmPrototypeMetadata,
};
