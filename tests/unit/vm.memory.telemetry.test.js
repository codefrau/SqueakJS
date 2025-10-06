import test from "node:test";
import assert from "node:assert/strict";

import { startMemoryTelemetry, recordMemoryTelemetrySample } from "../../vm.memory.telemetry.js";
import { getTelemetryChannelState, resetTelemetryChannels } from "../../vm.telemetry.channel.js";

const MB = 1_000_000;

function createStubVM() {
  const image = {
    headRoom: 32 * MB,
    oldSpaceBytes: 96 * MB,
    totalMemory: 128 * MB,
    memoryPolicy: { headroomBytes: 32 * MB, lowSpaceBytes: 8 * MB },
    _finalizeMemoryPolicyAfterLoad() {},
    _syncLowSpaceMonitor() {},
    captureMemorySnapshot(reason) {
      return {
        timestamp: Date.now(),
        reason,
        totalBytes: this.totalMemory,
        usedBytes: this.totalMemory - this.headRoom,
        freeBytes: this.headRoom,
        youngSpaceBytes: 6 * MB,
        newSpaceBytes: 2 * MB,
        policy: Object.assign({}, this.memoryPolicy),
        host: {
          usedJSHeapSize: 72 * MB,
          jsHeapSizeLimit: 200 * MB,
        },
      };
    },
  };
  const vm = { image, options: { memoryTelemetry: { intervalMs: 0, logEvery: 0 } } };
  image.vm = vm;
  return vm;
}

test("memory telemetry emits standardized samples", () => {
  resetTelemetryChannels("memory");
  const events = [];
  const global = globalThis;
  const squeak = global.Squeak || (global.Squeak = {});
  const previousTelemetry = squeak.telemetry;
  squeak.telemetry = {
    emit(eventName, payload) {
      events.push({ eventName, payload });
    }
  };

  try {
    const vm = createStubVM();
    const telemetry = startMemoryTelemetry(vm, vm.options);
    assert.ok(telemetry && telemetry.enabled, "telemetry should start enabled");
    assert.ok(events.length >= 1, "startup should emit a telemetry sample");
    const startupEvent = events[0];
    assert.strictEqual(startupEvent.eventName, "memory.sample");
    assert.strictEqual(startupEvent.payload.namespace, "memory");
    assert.strictEqual(startupEvent.payload.type, "sample");
    assert.strictEqual(startupEvent.payload.payload.reason, "startup");
    assert.ok(startupEvent.payload.payload.headroomBytes > 0);

    recordMemoryTelemetrySample(vm, "manual");
    const latestEvent = events[events.length - 1];
    assert.strictEqual(latestEvent.payload.payload.reason, "manual");
    assert.ok(latestEvent.payload.payload.sequence >= 2);

    const channel = getTelemetryChannelState("memory");
    assert.ok(channel, "memory channel state should exist");
    assert.ok(channel.history.length >= 2, "channel history should accumulate samples");
  } finally {
    if (previousTelemetry) {
      squeak.telemetry = previousTelemetry;
    } else {
      delete squeak.telemetry;
      if (Object.keys(squeak).length === 0) {
        delete global.Squeak;
      }
    }
  }
});

