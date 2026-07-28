"use strict";
// Bench fase 0 del diseño stack-zone: 5 variantes, mismo fib(32) por sends.
const fs = require("fs");
const path = require("path");
const mimic = require("./js/mimic.js"); // V0: contexts + recursión JS (spike anterior)
const { makeContextVM, makeFrameTrampolineVM, makeFrameInterpVM } = require("./js/variants.js");

const N = 32, EXPECT_RESULT = 2178309, EXPECT_SENDS = 7049155;
const WARMUP = 3, RUNS = 7;

async function loadWasm() {
    const bytes = fs.readFileSync(path.join(__dirname, "as/frames.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, {
        env: { abort: () => { throw new Error("wasm abort"); } },
    });
    instance.exports.init();
    return instance.exports;
}

function bench(name, runFn) {
    let best = Infinity, r;
    for (let i = 0; i < WARMUP; i++) r = runFn(N);
    for (let i = 0; i < RUNS; i++) {
        r = runFn(N);
        if (r.ns < best) best = r.ns;
    }
    if (r.result !== EXPECT_RESULT) throw Error(name + ": resultado " + r.result);
    // V0 cuenta la activación raíz como send; V1-V4 no (la arman a mano)
    if (r.sends !== EXPECT_SENDS && r.sends !== EXPECT_SENDS - 1)
        throw Error(name + ": sends " + r.sends);
    return { name, ms: best / 1e6, sendsPerSec: EXPECT_SENDS / (best / 1e9) };
}

(async () => {
    const wasm = await loadWasm();
    const wasmRun = (n) => {
        const t0 = process.hrtime.bigint();
        const result = wasm.run(n);
        const t1 = process.hrtime.bigint();
        return { result, sends: wasm.getSends(), ns: Number(t1 - t0) };
    };

    const rows = [
        bench("V0 contexts + recursión JS (spike anterior, referencia)", mimic),
        bench("V1 contexts + trampolín (≈ jit.js actual)", makeContextVM()),
        bench("V2 frames + trampolín (jit.js con stack zone, JS puro)", makeFrameTrampolineVM()),
        bench("V3 frames + intérprete bytecodes JS", makeFrameInterpVM()),
        bench("V4 frames + intérprete bytecodes WASM", wasmRun),
        bench("V5 frames + métodos compilados WASM (estimador fase 2)", (n) => {
            const t0 = process.hrtime.bigint();
            const result = wasm.run5(n);
            const t1 = process.hrtime.bigint();
            return { result, sends: wasm.getSends(), ns: Number(t1 - t0) };
        }),
    ];

    const base = rows[1].ms; // V1 = arquitectura actual
    console.log(`fib(${N}) = ${EXPECT_RESULT}, ${(EXPECT_SENDS / 1e6).toFixed(2)}M sends, best of ${RUNS} (tras ${WARMUP} warmup)\n`);
    for (const r of rows) {
        const ratio = base / r.ms;
        console.log(
            r.ms.toFixed(1).padStart(7) + " ms  " +
            (r.sendsPerSec / 1e6).toFixed(1).padStart(6) + "M sends/s  " +
            (ratio >= 1 ? (ratio.toFixed(2) + "x más rápido que V1") : ((r.ms / base).toFixed(2) + "x más lento que V1")).padStart(24) + "  " +
            r.name
        );
    }
})();
