import assert from "assert";
import { performance } from "perf_hooks";
import path from "path";
import { fileURLToPath } from "url";
import { buildWasmPrototype } from "../../tools/build-wasm.mjs";
import {
    runPrototypeLoop,
    resetWasmPrototypeInstance,
} from "../../vm.interpreter.wasm.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureArtifacts() {
    const outDir = path.resolve(__dirname, "..", "..", "dist", "wasm");
    await buildWasmPrototype({ outDir });
}

function runLoopInJS(iterations) {
    let acc = 0;
    for (let i = 0; i < iterations; i++) {
        acc = ((acc + (i & 255)) ^ (acc << 1)) | 0;
    }
    return acc | 0;
}

function average(samples) {
    if (!samples.length) return 0;
    return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

async function benchmark(iterations, samples) {
    const wasmDurations = [];
    const jsDurations = [];
    let wasmResult = null;
    let jsResult = null;

    for (let i = 0; i < samples; i++) {
        const start = performance.now();
        wasmResult = await runPrototypeLoop(iterations);
        wasmDurations.push(performance.now() - start);
    }

    for (let i = 0; i < samples; i++) {
        const start = performance.now();
        jsResult = runLoopInJS(iterations);
        jsDurations.push(performance.now() - start);
    }

    assert.strictEqual(wasmResult | 0, jsResult | 0, "WASM loop should match JS loop output");

    return {
        wasm: wasmDurations,
        js: jsDurations,
        wasmAverage: average(wasmDurations),
        jsAverage: average(jsDurations),
        wasmResult,
        jsResult,
    };
}

(async function main() {
    await ensureArtifacts();
    resetWasmPrototypeInstance();
    await runPrototypeLoop(1); // Warm the module

    const verificationCases = [0, 1, 2, 10, 1024];
    for (const iterations of verificationCases) {
        const wasmValue = await runPrototypeLoop(iterations);
        const jsValue = runLoopInJS(iterations);
        assert.strictEqual(wasmValue | 0, jsValue | 0, `Mismatch for ${iterations} iterations`);
    }

    const iterations = 500000;
    const samples = 5;
    const results = await benchmark(iterations, samples);

    console.log("WASM loop average (ms):", results.wasmAverage.toFixed(3));
    console.log("JS loop average (ms):", results.jsAverage.toFixed(3));
    console.log("WASM samples:", results.wasm.map(v => v.toFixed(3)).join(", "));
    console.log("JS samples:", results.js.map(v => v.toFixed(3)).join(", "));
})();
