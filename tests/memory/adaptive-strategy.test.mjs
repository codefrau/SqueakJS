import assert from "assert";

const MB = 1_000_000;

function createSnapshot({
    headroomMB,
    youngMB = 0,
    newMB = 0,
    freeMB,
    oldMB = 0,
    hostUsedMB,
    hostLimitMB,
}) {
    const headroomBytes = Math.round(headroomMB * MB);
    const youngBytes = Math.round(youngMB * MB);
    const newBytes = Math.round(newMB * MB);
    const oldBytes = Math.round(oldMB * MB);
    const totalBytes = oldBytes + headroomBytes;
    const usedHeadroom = youngBytes + newBytes;
    const computedFree = headroomBytes - usedHeadroom;
    const freeBytes = Math.round((freeMB !== undefined ? freeMB * MB : computedFree));
    return {
        timestamp: Date.now(),
        totalBytes,
        oldSpaceBytes: oldBytes,
        youngSpaceBytes: youngBytes,
        newSpaceBytes: newBytes,
        freeBytes: freeBytes >= 0 ? freeBytes : 0,
        usedBytes: totalBytes - (freeBytes >= 0 ? freeBytes : 0),
        youngAllocatedBytes: youngBytes + newBytes,
        policy: {
            headroomBytes,
            lowSpaceBytes: Math.round(1 * MB),
            newSpaceLimit: Math.round(youngBytes + newBytes),
            youngSpaceRatio: 0.2,
            explicitYoungBytes: null,
        },
        host: {
            usedJSHeapSize: hostUsedMB !== undefined ? Math.round(hostUsedMB * MB) : undefined,
            jsHeapSizeLimit: hostLimitMB !== undefined ? Math.round(hostLimitMB * MB) : undefined,
        },
    };
}

class FakeImage {
    constructor({ headroomMB, oldSpaceMB, policyHeadroomMB }) {
        this.headRoom = Math.round(headroomMB * MB);
        this.oldSpaceBytes = Math.round(oldSpaceMB * MB);
        this.totalMemory = this.oldSpaceBytes + this.headRoom;
        const baseline = policyHeadroomMB !== undefined ? policyHeadroomMB : headroomMB;
        this.memoryPolicy = {
            headroomBytes: Math.round(baseline * MB),
            lowSpaceBytes: Math.round(1 * MB),
            newSpaceLimit: 0,
        };
        this.snapshots = [];
        this.snapshotReasons = [];
        this.appliedHeadrooms = [];
        this.gcReasons = [];
        this.youngSpaceBytes = 0;
        this.newSpaceBytes = 0;
    }

    _finalizeMemoryPolicyAfterLoad() {
        this.memoryPolicy.newSpaceLimit = Math.min(
            Math.round(this.headRoom * 0.5),
            this.headRoom
        );
    }

    _syncLowSpaceMonitor() {}

    _applyHeadroomAdjustment(bytes) {
        this.appliedHeadrooms.push(bytes);
        this.headRoom = Math.round(bytes);
        this.memoryPolicy.headroomBytes = this.headRoom;
        this.totalMemory = this.oldSpaceBytes + this.headRoom;
        this._finalizeMemoryPolicyAfterLoad();
    }

    _triggerPartialGC(reason) {
        this.gcReasons.push(reason);
        if (typeof this.onPartialGC === "function") {
            this.onPartialGC(reason);
        }
        return true;
    }

    captureMemorySnapshot(reason) {
        this.snapshotReasons.push(reason);
        if (!this.snapshots.length) {
            return createSnapshot({ headroomMB: this.headRoom / MB, oldMB: this.oldSpaceBytes / MB });
        }
        return this.snapshots.shift();
    }
}

function createVM(image, options) {
    return {
        image,
        options,
    };
}

const { startAdaptiveMemoryManager } = await import("../../vm.memory.adaptive.js");

// Growth when free space is consistently low and the host heap has capacity
{
    const image = new FakeImage({ headroomMB: 50, oldSpaceMB: 180 });
    image.snapshots.push(
        createSnapshot({ headroomMB: 50, youngMB: 12, newMB: 8, oldMB: 180, hostUsedMB: 110, hostLimitMB: 400 }),
        createSnapshot({ headroomMB: 50, youngMB: 38, newMB: 6, oldMB: 180, hostUsedMB: 140, hostLimitMB: 400 })
    );
    const vm = createVM(image, {
        memoryAdaptive: {
            intervalMs: 0,
            growStepMB: 12,
            shrinkStepMB: 8,
            maxHeadroomMB: 200,
        },
    });

    const manager = startAdaptiveMemoryManager(vm, vm.options);
    image.appliedHeadrooms = [];
    manager.poke("test-grow");
    manager.stop();

    assert.ok(image.appliedHeadrooms.length >= 1, "adaptive manager should adjust headroom when growing");
    const grown = image.appliedHeadrooms[image.appliedHeadrooms.length - 1];
    assert.strictEqual(grown, Math.round(62 * MB), "headroom should grow by the configured step size");
    assert.strictEqual(manager.lastDecision.action, "grow", "decision should mark growth");
    assert.strictEqual(manager.lastDecision.reason, "free-low", "growth should be driven by low free ratio");
    assert.ok(!manager.lastDecision.gcTriggered, "growth should not force a GC");
}

// Shrink when the host heap reports critical pressure and ensure GC happens first
{
    const image = new FakeImage({ headroomMB: 60, oldSpaceMB: 220 });
    image.snapshots.push(
        createSnapshot({ headroomMB: 60, youngMB: 18, newMB: 6, oldMB: 220, hostUsedMB: 700, hostLimitMB: 1000 }),
        createSnapshot({ headroomMB: 60, youngMB: 28, newMB: 8, oldMB: 220, hostUsedMB: 960, hostLimitMB: 1000 }),
        createSnapshot({ headroomMB: 60, youngMB: 20, newMB: 6, oldMB: 220, hostUsedMB: 890, hostLimitMB: 1000 })
    );
    image.onPartialGC = () => {
        // simulate the collector freeing young space before the next snapshot
        image.snapshots.unshift(
            createSnapshot({ headroomMB: 60, youngMB: 18, newMB: 4, oldMB: 220, hostUsedMB: 910, hostLimitMB: 1000 })
        );
    };
    const vm = createVM(image, {
        memoryAdaptive: {
            intervalMs: 0,
            shrinkStepMB: 10,
            growStepMB: 8,
            minimumFreeMB: 2,
            gcThrottleMs: 0,
        },
    });

    const manager = startAdaptiveMemoryManager(vm, vm.options);
    image.appliedHeadrooms = [];
    manager.poke("test-shrink");
    manager.stop();

    assert.ok(image.gcReasons.some(reason => reason.includes("adaptive")), "adaptive manager should request a GC under pressure");
    assert.ok(image.appliedHeadrooms.length >= 1, "adaptive manager should adjust headroom when shrinking");
    const shrunk = image.appliedHeadrooms[image.appliedHeadrooms.length - 1];
    assert.strictEqual(shrunk, Math.round(50 * MB), "headroom should shrink by the configured step size");
    assert.strictEqual(manager.lastDecision.action, "shrink", "decision should mark shrink");
    assert.strictEqual(manager.lastDecision.reason, "host-pressure", "shrink should respond to host pressure");
    assert.ok(manager.lastDecision.gcTriggered, "shrink should note that a GC was triggered");
}

// Enforce host-cap derived ceilings to avoid exceeding the browser quota
{
    const image = new FakeImage({ headroomMB: 80, oldSpaceMB: 120, policyHeadroomMB: 40 });
    image.snapshots.push(
        createSnapshot({ headroomMB: 80, youngMB: 16, newMB: 8, oldMB: 120, hostUsedMB: 120, hostLimitMB: 180 }),
        createSnapshot({ headroomMB: 80, youngMB: 18, newMB: 6, oldMB: 120, hostUsedMB: 150, hostLimitMB: 180 })
    );
    const vm = createVM(image, {
        memoryAdaptive: {
            intervalMs: 0,
            shrinkStepMB: 12,
            growStepMB: 8,
            hostUsageCapRatio: 0.9,
            hostReserveRatio: 0.05,
            minimumFreeMB: 2,
        },
    });

    const manager = startAdaptiveMemoryManager(vm, vm.options);
    image.appliedHeadrooms = [];
    manager.poke("test-cap");
    manager.stop();

    assert.ok(image.appliedHeadrooms.length >= 1, "adaptive manager should clamp headroom when over host cap");
    const capped = image.appliedHeadrooms[image.appliedHeadrooms.length - 1];
    assert.strictEqual(capped, Math.round(42 * MB), "headroom should drop to the calculated host cap");
    assert.strictEqual(manager.lastDecision.action, "shrink", "decision should shrink due to cap");
    assert.strictEqual(manager.lastDecision.reason, "host-cap", "reason should identify the host cap");
    assert.ok(!manager.lastDecision.gcTriggered, "capping should not require a GC when space is available");
}
