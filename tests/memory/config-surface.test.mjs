import assert from "assert";

const MB = 1_000_000;

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

const {
    normalizeMemoryOptions,
    deriveYoungSpaceLimit,
    DEFAULT_HEADROOM_BYTES,
    DEFAULT_LOW_SPACE_BYTES,
    DEFAULT_YOUNG_SPACE_RATIO,
} = await import("../../vm.memory.config.js");

const normalized = normalizeMemoryOptions({
    headroomMB: 256,
    youngPercent: 25,
    gcThresholdMB: 12,
    youngSpaceBytes: 8 * MB,
});
assert.strictEqual(normalized.headroomBytes, 256 * MB, "headroomMB should convert to bytes");
assert.strictEqual(normalized.lowSpaceBytes, 12 * MB, "gcThresholdMB should convert to bytes");
assert.strictEqual(normalized.explicitYoungBytes, 8 * MB, "explicit young space bytes should be preserved");
assert.strictEqual(normalized.youngSpaceRatio, 0.25, "youngPercent should map to ratio");

const defaults = normalizeMemoryOptions();
assert.strictEqual(defaults.headroomBytes, DEFAULT_HEADROOM_BYTES, "default headroom should be 100MB");
assert.strictEqual(defaults.lowSpaceBytes, DEFAULT_LOW_SPACE_BYTES, "default low space threshold should be 1MB");
assert.strictEqual(defaults.youngSpaceRatio, DEFAULT_YOUNG_SPACE_RATIO, "default young space ratio should match constant");

const derivedExplicit = deriveYoungSpaceLimit(100 * MB, normalized);
assert.strictEqual(derivedExplicit, 8 * MB, "explicit young bytes should override ratio");

const ratioPolicy = normalizeMemoryOptions({ youngSpaceRatio: 0.4 });
const derivedRatio = deriveYoungSpaceLimit(90 * MB, ratioPolicy);
assert.strictEqual(derivedRatio, Math.round(90 * MB * 0.4), "ratio-based limit should be proportional to total memory");

const image = new Squeak.Image("memory-test", {
    headroomMB: 64,
    youngSpaceRatio: 0.25,
    gcThresholdMB: 4,
});
image.oldSpaceBytes = 32 * MB;
image.totalMemory = image.oldSpaceBytes + image.headRoom;
image.totalMemory = Math.ceil(image.totalMemory / MB) * MB;
image._finalizeMemoryPolicyAfterLoad();

let lastLowSpaceBytes = null;
const gcReasons = [];
image.vm = {
    signalLowSpaceIfNecessary(bytes) {
        lastLowSpaceBytes = bytes;
    },
    addMessage: () => {},
    nilObj: null,
    forceInterruptCheck: () => {},
};
image._triggerPartialGC = function(reason) {
    gcReasons.push(reason);
    this.youngSpaceBytes = 0;
    this.newSpaceBytes = 0;
    this._syncLowSpaceMonitor();
    return null;
};

image.youngSpaceBytes = 4 * MB;
image.newSpaceBytes = 0;

image._trackNewAllocationBytes(10 * MB);
assert.strictEqual(lastLowSpaceBytes, image.bytesLeft(), "bytesLeft should reflect updated allocation state");
assert.strictEqual(gcReasons.length, 0, "allocation below limit should not trigger GC");

image._trackNewAllocationBytes(25 * MB);
assert.strictEqual(gcReasons.length, 1, "allocation above limit should trigger GC");
assert.strictEqual(gcReasons[0], "allocation", "auto GC reason should be tagged as allocation");

assert.ok(image.memoryPolicy.newSpaceLimit <= image.totalMemory - image.oldSpaceBytes + 1, "new space limit should not exceed available headroom");

console.log("Memory configuration surface validated", {
    headroomBytes: image.headRoom,
    newSpaceLimit: image.memoryPolicy.newSpaceLimit,
    lowSpaceThreshold: image.vm ? image.vm.lowSpaceThreshold : undefined,
});
