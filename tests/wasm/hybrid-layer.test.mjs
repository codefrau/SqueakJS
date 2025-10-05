import assert from "assert";

if (!globalThis.Squeak) globalThis.Squeak = {};

const {
    listExecutionBackends,
    getExecutionBackendForVM,
    configureExecutionBackendForVM,
} = await import("../../vm.execution.js");

class FakeVM {
    constructor(options = {}) {
        this.options = options;
        this.calls = [];
        this.image = options.image || {
            writeToBuffer() {
                return new ArrayBuffer(0);
            },
        };
    }

    _interpretSliceJS(forMilliseconds, thenDo) {
        this.calls.push({ forMilliseconds, thenDo });
        if (typeof thenDo === "function") thenDo(0);
        return 0;
    }
}

function captureWarnings(run) {
    const originalWarn = console.warn;
    let messages = [];
    console.warn = function(...args) {
        messages.push(args.map(String).join(" "));
    };
    try {
        run(messages);
    } finally {
        console.warn = originalWarn;
    }
    return messages;
}

const backends = listExecutionBackends();
assert.ok(backends.includes("js-interpreter"), "JS backend should be registered");
assert.ok(backends.includes("wasm-prototype"), "WASM prototype backend should be registered");

const defaultVM = new FakeVM();
const defaultBackend = getExecutionBackendForVM(defaultVM);
assert.strictEqual(defaultBackend.name, "js-interpreter", "Default backend should be JS interpreter");
defaultBackend.interpret(5, () => {});
assert.strictEqual(defaultVM.calls.length, 1, "JS backend should invoke fallback interpreter slice");

const wasmVM = new FakeVM({ executionBackend: "wasm-prototype" });
const wasmBackend = getExecutionBackendForVM(wasmVM);
assert.strictEqual(wasmBackend.name, "wasm-prototype", "Requested wasm-prototype backend should be selected");
wasmBackend.interpret(10, () => {});
assert.strictEqual(wasmVM.calls.length, 1, "WASM backend should still run JS slice for now");

configureExecutionBackendForVM(wasmVM, "js-interpreter");
assert.strictEqual(getExecutionBackendForVM(wasmVM).name, "js-interpreter", "Reconfiguration should swap backend");

const warnings = captureWarnings(() => {
    const unknownVM = new FakeVM({ executionBackend: "not-a-backend" });
    const backend = getExecutionBackendForVM(unknownVM);
    assert.strictEqual(backend.name, "js-interpreter", "Unknown backend should fall back to default");
});
assert.ok(warnings.length >= 1, "Unknown backend selection should emit a warning");

console.log("Registered backends:", backends.join(", "));
console.log("Fallback warning messages:", warnings);
