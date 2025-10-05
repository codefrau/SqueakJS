import assert from "assert";

const MB = 1_000_000;

global.self = global;
global.window = global;
if (!global.performance) {
    global.performance = {};
}
if (!global.performance.now) {
    global.performance.now = () => 0;
}
if (!global.performance.memory) {
    global.performance.memory = {
        usedJSHeapSize: 20 * MB,
        totalJSHeapSize: 25 * MB,
        jsHeapSizeLimit: 40 * MB,
    };
}
if (!global.navigator) {
    global.navigator = {};
}
if (global.navigator.deviceMemory === undefined) {
    global.navigator.deviceMemory = 8;
}

await import("../../globals.js");
await import("../../vm.js");
await import("../../vm.object.js");
await import("../../vm.object.spur.js");
await import("../../vm.image.js");
await import("../../vm.primitives.js");

const { startMemoryTelemetry, recordMemoryTelemetrySample } = await import("../../vm.memory.telemetry.js");

const image = new Squeak.Image("telemetry-test", {
    headroomMB: 64,
    gcThresholdMB: 8,
    youngSpaceRatio: 0.25,
});
image.oldSpaceBytes = 40 * MB;
image.youngSpaceBytes = 5 * MB;
image.newSpaceBytes = 2 * MB;
image.totalMemory = 80 * MB;
image.memoryPolicy.newSpaceLimit = 12 * MB;
image._finalizeMemoryPolicyAfterLoad();

const vm = {
    image,
    options: {
        memoryTelemetry: {
            intervalMs: 0,
            maxSamples: 3,
            logEvery: 0,
        },
    },
};
image.vm = vm;

const telemetry = startMemoryTelemetry(vm, vm.options);
assert.ok(telemetry);
assert.ok(telemetry.enabled, "telemetry should be enabled by default");
assert.strictEqual(telemetry.history.length, 1, "startup sample should be recorded immediately");
assert.strictEqual(telemetry.latest().reason, "startup");

// Drive memory pressure to trigger warnings and verify sampling utilities.
const originalWarn = console.warn;
const warnings = [];
console.warn = function(message, ...rest) {
    warnings.push([message, ...rest].join(" "));
};

image.memoryPolicy.lowSpaceBytes = 5 * MB;
image.oldSpaceBytes = 70 * MB;
image.youngSpaceBytes = 4 * MB;
image.newSpaceBytes = 2 * MB;
performance.memory.usedJSHeapSize = 37 * MB;
performance.memory.totalJSHeapSize = 38 * MB;
performance.memory.jsHeapSizeLimit = 40 * MB;
recordMemoryTelemetrySample(vm, "pressure");

console.warn = originalWarn;
assert.ok(warnings.some((entry) => entry.includes("low memory")), "low-memory warning should be emitted");
assert.ok(warnings.some((entry) => entry.includes("host heap")), "host heap warning should be emitted");

// Additional samples keep bounded history.
image.oldSpaceBytes = 32 * MB;
image.youngSpaceBytes = 6 * MB;
image.newSpaceBytes = 3 * MB;
recordMemoryTelemetrySample(vm, "relax");

image.oldSpaceBytes = 34 * MB;
image.youngSpaceBytes = 7 * MB;
image.newSpaceBytes = 4 * MB;
recordMemoryTelemetrySample(vm, "extra");

assert.strictEqual(telemetry.history.length, 3, "history should cap at configured max");
assert.strictEqual(telemetry.history[0].reason, "pressure", "oldest sample should be retained after trimming startup");
assert.strictEqual(telemetry.history[2].reason, "extra");

const latestArray = image.latestMemorySnapshotArray();
assert.strictEqual(latestArray.length, 18, "snapshot array should expose 18 fields");
assert.strictEqual(latestArray[17], "extra", "last field should be sample reason");

const historyArrays = image.memoryTelemetryHistoryArrays();
assert.strictEqual(historyArrays.length, 3);
assert.strictEqual(historyArrays[historyArrays.length - 1][17], "extra");

const primitiveContext = { vm };
const snapshotParam = Squeak.Primitives.prototype.vmParameterAt.call(primitiveContext, 68);
const historyParam = Squeak.Primitives.prototype.vmParameterAt.call(primitiveContext, 69);
assert.strictEqual(Array.isArray(snapshotParam), true);
assert.strictEqual(snapshotParam.length, 18);
assert.strictEqual(Array.isArray(historyParam), true);
assert.strictEqual(historyParam.length, 3);

telemetry.stop();

console.log("Memory telemetry module verified", {
    historySize: telemetry.history.length,
    latestReason: telemetry.history[telemetry.history.length - 1].reason,
});
