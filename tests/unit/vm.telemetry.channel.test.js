import test from "node:test";
import assert from "node:assert/strict";

import {
  configureTelemetryChannel,
  emitTelemetryEvent,
  getTelemetryChannelState,
  resetTelemetryChannels,
} from "../../vm.telemetry.channel.js";

function withTelemetryEmitter(callback) {
  const global = globalThis;
  const squeak = global.Squeak || (global.Squeak = {});
  const previous = squeak.telemetry;
  const events = [];
  squeak.telemetry = {
    emit(eventName, payload) {
      events.push({ eventName, payload });
    }
  };
  try {
    return callback(events);
  } finally {
    if (previous) {
      squeak.telemetry = previous;
    } else {
      delete squeak.telemetry;
      if (Object.keys(squeak).length === 0) {
        delete global.Squeak;
      }
    }
  }
}

test("emits structured telemetry with bounded history", () => {
  resetTelemetryChannels("unit");
  const channel = configureTelemetryChannel("unit", { version: 3, bufferLimit: 2 });

  withTelemetryEmitter((events) => {
    const firstResult = emitTelemetryEvent("unit", "sample", { value: 1 }, { eventName: "unit.sample" });
    emitTelemetryEvent("unit", "sample", { value: 2 }, { eventName: "unit.sample" });
    emitTelemetryEvent("unit", "sample", { value: 3 }, { eventName: "unit.sample" });

    assert.strictEqual(firstResult, true, "first emission should succeed");
    assert.strictEqual(events.length, 3, "each emission should reach the emitter");
    const envelope = events[0].payload;
    assert.ok(envelope.timestamp, "envelope should include timestamp");
    assert.strictEqual(envelope.namespace, "unit");
    assert.strictEqual(envelope.version, 3);
    assert.deepStrictEqual(events[0].payload.payload, { value: 1 });
    assert.strictEqual(events[0].eventName, "unit.sample");

    const state = getTelemetryChannelState("unit");
    assert.ok(state, "channel state should be available");
    assert.strictEqual(state.history.length, 2, "history should respect buffer limit");
    assert.strictEqual(state.history[0].payload.value, 2, "history should retain newest entries");

    const dedupeFirst = emitTelemetryEvent("unit", "sample", { value: 3 }, {
      eventName: "unit.sample",
      dedupeKey: { value: 3 },
    });
    const dedupeSecond = emitTelemetryEvent("unit", "sample", { value: 3 }, {
      eventName: "unit.sample",
      dedupeKey: { value: 3 },
    });
    assert.strictEqual(dedupeFirst, true, "first emission with signature should succeed");
    assert.strictEqual(dedupeSecond, false, "dedupe should suppress identical signature");
    assert.strictEqual(state.history.length, 2, "history should remain bounded after dedupe");
  });

  assert.strictEqual(channel.version, 3);
});

