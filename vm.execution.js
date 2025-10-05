"use strict";

import {
    runPrototypeLoop,
    ensureWasmPrototypeInstance,
    binaryIntOpSync,
    binaryCompareOpSync,
    binarySeriesOpSync,
} from "./vm.interpreter.wasm.js";

export { binarySeriesOpSync } from "./vm.interpreter.wasm.js";
import { ensureSharedHeapForVM, getSharedHeapForVM, sharedHeapIsShared, markSharedHeapDirty } from "./vm.execution.state.js";
import {
    configureWasmPrototypeAsset,
    getWasmPrototypeAssetCapabilities,
    getWasmPrototypeAssetURL,
    getWasmPrototypeCacheStats,
    clearWasmPrototypeAssetCache,
} from "./vm.execution.assets.js";

const registry = new Map();
const invalidBackendWarnings = new Set();
const backendSlot = Symbol.for("Squeak.Execution.backend");
let defaultBackendName = "js-interpreter";
let preferredBackendName = null;
let integerBinaryOpAccelerator = null;

function ensureSqueakNamespace() {
    if (typeof globalThis !== "undefined") {
        if (!globalThis.Squeak) globalThis.Squeak = {};
        if (!globalThis.Squeak.Execution) {
            globalThis.Squeak.Execution = {};
        }
        if (!globalThis.Squeak.Execution.assets) {
            globalThis.Squeak.Execution.assets = {};
        }
        Object.assign(globalThis.Squeak.Execution.assets, {
            configureWasmPrototypeAsset,
            getWasmPrototypeAssetCapabilities,
            getWasmPrototypeAssetURL,
            getWasmPrototypeCacheStats,
            clearWasmPrototypeAssetCache,
        });
    }
}

ensureSqueakNamespace();

function normalizeOptions(options) {
    if (!options || typeof options !== "object") return {};
    return options;
}

function warnOnce(message, key) {
    var id = key || message;
    if (invalidBackendWarnings.has(id)) return;
    invalidBackendWarnings.add(id);
    if (typeof console !== "undefined" && console.warn) {
        console.warn(message);
    }
}

function setIntegerBinaryOpAccelerator(handler) {
    if (typeof handler === "function") integerBinaryOpAccelerator = handler;
    else integerBinaryOpAccelerator = null;
}

export function invokeIntegerBinaryOpAccelerator(vm, request) {
    if (typeof integerBinaryOpAccelerator !== "function") return null;
    try {
        return integerBinaryOpAccelerator(vm, request) || null;
    } catch (error) {
        warnOnce("Integer accelerator failed: " + error, "integer-accelerator:" + (request && request.primitiveIndex));
        return null;
    }
}

function selectBackendName(requestedName, options) {
    var opts = normalizeOptions(options);
    var name = requestedName;
    if (!name && typeof opts.executionBackend === "string") {
        name = opts.executionBackend;
    }
    if (!name && typeof opts.vmBackend === "string") {
        name = opts.vmBackend;
    }
    if (!name && typeof opts.backend === "string") {
        name = opts.backend;
    }
    if (name && registry.has(name)) {
        return name;
    }
    if (name && !registry.has(name)) {
        warnOnce("Unknown execution backend '" + name + "', falling back to default", name);
    }
    if (preferredBackendName && registry.has(preferredBackendName)) {
        return preferredBackendName;
    }
    return defaultBackendName;
}

function instantiateBackend(vm, requestedName, options) {
    if (!vm) {
        throw new TypeError("Expected VM instance when creating execution backend");
    }
    var opts = normalizeOptions(options || vm.options);
    var targetName = selectBackendName(requestedName, opts);
    var descriptor = registry.get(targetName);
    if (!descriptor) {
        throw new Error("No execution backend registered under '" + targetName + "'");
    }
    var backend;
    try {
        backend = descriptor.create(vm, opts) || null;
    } catch (error) {
        if (targetName !== defaultBackendName) {
            warnOnce("Failed to initialize backend '" + targetName + "': " + error, targetName + ":error");
            descriptor = registry.get(defaultBackendName);
            backend = descriptor ? descriptor.create(vm, opts) : null;
            targetName = defaultBackendName;
        } else {
            throw error;
        }
    }
    if (!backend || typeof backend.interpret !== "function") {
        throw new Error("Execution backend '" + targetName + "' did not provide an interpret() function");
    }
    if (!backend.name) {
        backend.name = targetName;
    }
    backend.vm = vm;
    return backend;
}

function disposeBackend(backend) {
    if (!backend) return;
    if (typeof backend.dispose === "function") {
        try { backend.dispose(); } catch (_) {}
    }
}

export function registerExecutionBackend(descriptor) {
    if (!descriptor || typeof descriptor.name !== "string" || !descriptor.name) {
        throw new TypeError("Execution backend descriptor must include a non-empty name");
    }
    if (typeof descriptor.create !== "function") {
        throw new TypeError("Execution backend '" + descriptor.name + "' must provide a create(vm, options) function");
    }
    if (registry.has(descriptor.name)) {
        warnOnce("Execution backend '" + descriptor.name + "' is already registered", descriptor.name + ":duplicate");
        return;
    }
    registry.set(descriptor.name, {
        create: descriptor.create,
        describe: typeof descriptor.describe === "function" ? descriptor.describe : function(vm, options) {
            return { name: descriptor.name };
        },
    });
    if (descriptor.default === true || descriptor.name === defaultBackendName) {
        defaultBackendName = descriptor.name;
    }
}

export function listExecutionBackends() {
    return Array.from(registry.keys());
}

export function getExecutionBackendInfo(name) {
    var descriptor = registry.get(name);
    if (!descriptor) return null;
    return { name: name };
}

export function getDefaultExecutionBackendName() {
    return defaultBackendName;
}

export function setPreferredExecutionBackendName(name) {
    if (name == null) {
        preferredBackendName = null;
        return null;
    }
    if (!registry.has(name)) {
        throw new Error("Cannot prefer unknown execution backend '" + name + "'");
    }
    preferredBackendName = name;
    return preferredBackendName;
}

export function getPreferredExecutionBackendName() {
    return preferredBackendName;
}

export function configureExecutionBackendForVM(vm, requestedName) {
    if (!vm) throw new TypeError("VM is required to configure execution backend");
    disposeBackend(vm[backendSlot]);
    var backend = instantiateBackend(vm, requestedName, vm.options);
    vm[backendSlot] = backend;
    return backend;
}

export function getExecutionBackendForVM(vm, requestedName) {
    if (!vm) throw new TypeError("VM is required to retrieve execution backend");
    var backend = vm[backendSlot];
    if (backend && (!requestedName || backend.name === requestedName)) {
        return backend;
    }
    if (backend && requestedName && backend.name !== requestedName) {
        disposeBackend(backend);
        backend = null;
    }
    if (!backend) {
        backend = instantiateBackend(vm, requestedName, vm.options);
        vm[backendSlot] = backend;
    }
    return backend;
}

export {
    configureWasmPrototypeAsset,
    getWasmPrototypeAssetCapabilities,
    getWasmPrototypeAssetURL,
    getWasmPrototypeCacheStats,
    clearWasmPrototypeAssetCache,
};

export function getExecutionBackendName(vm) {
    var backend = vm && vm[backendSlot];
    return backend && backend.name || null;
}

function createJSInterpreterBackend(vm) {
    setIntegerBinaryOpAccelerator(null);
    return {
        name: "js-interpreter",
        interpret: function(forMilliseconds, thenDo) {
            return vm._interpretSliceJS(forMilliseconds, thenDo);
        },
        dispose: function() {},
    };
}

function createWasmPrototypeBackend(vm, options) {
    var opts = normalizeOptions(options);
    var prototypeOptions = opts.wasmPrototype || {};
    var iterations = typeof prototypeOptions.iterations === "number" && prototypeOptions.iterations >= 0
        ? prototypeOptions.iterations | 0
        : 0;
    var preferShared = prototypeOptions.preferShared !== false;
    var pending = null;
    var lastHeap = null;
    var arithmeticMap = { 1: 0, 2: 1, 9: 2 };
    var compareMap = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5 };
    function syncSharedHeap(forceSync) {
        try {
            lastHeap = ensureSharedHeapForVM(vm, {
                preferShared: preferShared,
                forceSync: forceSync,
            });
        } catch (error) {
            warnOnce("Unable to synchronise shared heap for wasm backend: " + error, "wasm-prototype:shared-heap");
        }
        return lastHeap;
    }
    syncSharedHeap(true);
    function triggerPrototype(iterationCount) {
        if (typeof runPrototypeLoop !== "function") return;
        if (pending) return;
        pending = runPrototypeLoop(Math.max(0, iterationCount | 0)).catch(function(error) {
            warnOnce("WASM prototype loop failed: " + error, "wasm-prototype:loop-error");
        }).finally(function() {
            pending = null;
        });
    }
    function accelerateIntegerPrimitive(vmInstance, request) {
        if (!request || (request.kind && request.kind !== "smallint-primitive")) return null;
        if (request.type !== "int" && request.type !== "bool") return null;
        ensureWasmPrototypeInstance();
        if (request.type === "int") {
            var arithmeticOp = arithmeticMap[request.primitiveIndex];
            if (arithmeticOp == null) return null;
            var value = binaryIntOpSync(arithmeticOp, request.lhs, request.rhs);
            if (value == null) return null;
            return {
                handled: true,
                type: "int",
                value: value | 0,
                source: "wasm-prototype",
            };
        }
        var compareOp = compareMap[request.primitiveIndex];
        if (compareOp == null) return null;
        var boolValue = binaryCompareOpSync(compareOp, request.lhs, request.rhs);
        if (boolValue == null) return null;
        return {
            handled: true,
            type: "bool",
            value: !!boolValue,
            source: "wasm-prototype",
        };
    }

    setIntegerBinaryOpAccelerator(accelerateIntegerPrimitive);
    ensureWasmPrototypeInstance();

    return {
        name: "wasm-prototype",
        interpret: function(forMilliseconds, thenDo) {
            syncSharedHeap(true);
            var sliceIterations = iterations;
            if (sliceIterations === 0 && typeof forMilliseconds === "number" && isFinite(forMilliseconds)) {
                sliceIterations = Math.max(0, Math.round(forMilliseconds * 1000));
            }
            if (sliceIterations > 0) triggerPrototype(sliceIterations);
            return vm._interpretSliceJS(forMilliseconds, thenDo);
        },
        describe: function() {
            var heap = lastHeap || syncSharedHeap(false);
            return {
                name: "wasm-prototype",
                sharedHeap: heap ? {
                    byteLength: heap.byteLength,
                    shared: heap.shared,
                    version: heap.version,
                } : null,
                accelerators: {
                    integerBinary: Object.keys(arithmeticMap).length,
                    integerCompare: Object.keys(compareMap).length,
                },
            };
        },
        dispose: function() {
            setIntegerBinaryOpAccelerator(null);
        },
    };
}

registerExecutionBackend({
    name: "js-interpreter",
    create: createJSInterpreterBackend,
    default: true,
});

registerExecutionBackend({
    name: "wasm-prototype",
    create: createWasmPrototypeBackend,
});

const api = {
    registerBackend: registerExecutionBackend,
    listBackends: listExecutionBackends,
    getDefaultBackendName: getDefaultExecutionBackendName,
    setPreferredBackendName: setPreferredExecutionBackendName,
    getPreferredBackendName: getPreferredExecutionBackendName,
    configureBackendForVM: configureExecutionBackendForVM,
    getBackendForVM: getExecutionBackendForVM,
    getBackendName: getExecutionBackendName,
    backendSymbol: backendSlot,
    ensureSharedHeapForVM,
    getSharedHeapForVM,
    sharedHeapIsShared,
    markSharedHeapDirty,
    invokeIntegerBinaryOpAccelerator,
    ensureWasmPrototypeInstance,
    binarySeriesOpSync,
};

ensureSqueakNamespace();
if (typeof globalThis !== "undefined") {
    if (!globalThis.Squeak.Execution) {
        globalThis.Squeak.Execution = {};
    }
    Object.assign(globalThis.Squeak.Execution, api);
}

export default api;
