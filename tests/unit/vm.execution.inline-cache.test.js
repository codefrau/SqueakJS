import test from "node:test";
import assert from "node:assert/strict";

import { createInlineCacheMonitor } from "../../vm.execution.inline-cache.js";

test("inline cache monitor records hits, misses, and telemetry samples", () => {
  const emissions = [];
  const monitor = createInlineCacheMonitor({
    sampleInterval: 2,
    emit: (namespace, type, payload) => {
      emissions.push({ namespace, type, payload });
    }
  });

  monitor.recordHit(1, { selectorHash: 10, classId: 20 });
  monitor.recordMiss(4, { selectorHash: 11, classId: 21, evicted: true });
  monitor.onOpcode({ opcode: 0xD0, singleStep: false });
  monitor.recordSendSite({ selectorId: "sample", argCount: 1, opcode: 0xD0 });

  const snapshot = monitor.snapshot();
  assert.equal(snapshot.lookups, 2);
  assert.equal(snapshot.hits, 1);
  assert.equal(snapshot.misses, 1);
  assert.equal(snapshot.evictions, 1);
  assert.equal(snapshot.probeHistogram["1"], 1);
  assert.equal(snapshot.probeHistogram["4"], 1);
  assert.deepEqual(snapshot.lastOpcode, {
    opcode: 0xD0,
    singleStep: false,
    timestamp: snapshot.lastOpcode.timestamp
  });
  assert.equal(snapshot.recentSendSites.length, 1);
  assert.equal(snapshot.recentSendSites[0].selectorId, "sample");
  assert.equal(snapshot.recentSendSites[0].opcode, 0xD0);

  assert.equal(emissions.length, 1);
  assert.equal(emissions[0].namespace, "vm.inlineCache");
  assert.equal(emissions[0].type, "sample");
  assert.equal(emissions[0].payload.metrics.lookups, 2);
});

test("inline cache monitor reset clears accumulated state", () => {
  const monitor = createInlineCacheMonitor({ sampleInterval: 10, disableTelemetry: true });
  monitor.recordHit(1, { selectorId: "foo" });
  monitor.recordMiss(3, { selectorId: "bar" });
  monitor.recordSendSite({ selectorId: "baz", opcode: 1 });
  monitor.onOpcode({ opcode: 123, singleStep: true });

  monitor.reset();
  const snapshot = monitor.snapshot();
  assert.equal(snapshot.lookups, 0);
  assert.equal(snapshot.hits, 0);
  assert.equal(snapshot.misses, 0);
  assert.equal(Object.keys(snapshot.probeHistogram).length, 0);
  assert.equal(snapshot.recentSendSites.length, 0);
  assert.equal(snapshot.lastOpcode, null);
  assert.equal(snapshot.lastEvent, null);
});

test("inline cache monitor tracks evictions and handles disabled sampling", () => {
  const emissions = [];
  const monitor = createInlineCacheMonitor({ sampleInterval: 0, emit: (...args) => emissions.push(args) });

  monitor.recordHit("not-a-number", { selectorId: "noop" });
  monitor.recordEviction({ selectorId: "foo", classId: 99 });
  monitor.recordMiss(3, { selectorId: "bar", classId: 12 });
  monitor.recordSendSite(null);
  monitor.recordSendSite({});

  const snapshot = monitor.snapshot();
  assert.equal(snapshot.lookups, 3);
  assert.equal(snapshot.evictions, 1);
  assert.equal(snapshot.misses, 2);
  assert.equal(snapshot.hits, 0);
  assert.equal(snapshot.probeHistogram["3"], 1);
  assert.equal(snapshot.lastEvent.kind, "miss");
  assert.equal(snapshot.lastEvent.evicted, false);
  assert.equal(snapshot.recentSendSites.length, 0);
  assert.deepEqual(emissions, []);
});

test("inline cache monitor tolerates emitter failures when sampling", () => {
  let throws = true;
  const monitor = createInlineCacheMonitor({
    sampleInterval: 1,
    emit: () => {
      if (throws) {
        throws = false;
        throw new Error("emit failure");
      }
    }
  });

  monitor.recordMiss(1, { selectorId: "foo" });
  monitor.recordHit(1, { selectorId: "foo" });

  const snapshot = monitor.snapshot();
  assert.equal(snapshot.lookups, 2);
  assert.equal(snapshot.hits, 1);
  assert.equal(snapshot.misses, 1);
});
