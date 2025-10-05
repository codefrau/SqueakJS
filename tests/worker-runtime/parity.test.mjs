"use strict";

import assert from "assert";

global.self = global;
global.window = global;
if (!global.performance) {
    global.performance = { now: () => 0 };
}
if (!global.location) {
    global.location = { href: "" };
}
if (!global.navigator) {
    global.navigator = {};
}

await import("../../globals.js");
await import("../../vm.js");
await import("../../vm.object.js");
await import("../../vm.object.spur.js");
await import("../../vm.image.js");
await import("../../vm.interpreter.js");
await import("../../vm.primitives.js");
await import("../../vm.display.js");
await import("../../vm.display.worker.stub.js");
await import("../../vm.plugins.js");
await import("../../vm.plugins.file.browser.js");

const runtime = await import("../../vm.worker.runtime.js");
runtime.ensureWorkerAudioFallbacks();

const report = runtime.collectWorkerFeatureReport();

assert.ok(report, "feature report should be returned");
assert.ok(Array.isArray(report.display.supported));
assert.ok(Array.isArray(report.display.missing));
assert.ok(Array.isArray(report.display.fallbacks));

const supportedDisplayNames = report.display.supported.map((entry) => entry.name);
assert.ok(supportedDisplayNames.includes("primitiveShowDisplayRect"), "display rectangle primitive should be supported");

const missingDisplayNames = report.display.missing.map((entry) => entry.name);
assert.ok(!missingDisplayNames.includes("primitiveShowDisplayRect"), "core primitives should not be marked missing");

const fallbackDisplayNames = report.display.fallbacks.map((entry) => entry.name);
assert.ok(fallbackDisplayNames.includes("primitiveBeCursor"), "cursor primitive should be marked as fallback");

assert.strictEqual(report.audio.output.fallback, true, "audio output should rely on fallback");
assert.strictEqual(report.audio.input.fallback, true, "audio input should rely on fallback");

assert.ok(Array.isArray(report.file.missingOperations));
assert.strictEqual(report.file.missingOperations.length, 0, "file plugin should expose required operations");

assert.ok(Array.isArray(report.mainThreadDependencies));
const dependencyApis = report.mainThreadDependencies.map((entry) => entry.api);
assert.ok(dependencyApis.includes("Clipboard API (navigator.clipboard)"), "clipboard dependency should be documented");
assert.ok(dependencyApis.includes("Fullscreen API"), "fullscreen dependency should be documented");

console.log("Worker parity report validated", {
    supportedDisplay: supportedDisplayNames.length,
    missingDisplay: missingDisplayNames,
    audioFallbacks: report.audio,
});
