import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionProfiler } from "../../vm.execution.profiling.js";

test("execution profiler records send events via dispatch hooks", () => {
  const profiler = createExecutionProfiler();
  const hooks = profiler.createDispatchHooks();

  hooks.beforeOpcode({ opcode: 0x83 });
  hooks.onSend({ selector: { selector: "foo", hash: 123 }, argCount: 2, super: false });

  const events = profiler.getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "send");
  assert.equal(events[0].payload.selector, "foo");
  assert.equal(events[0].payload.selectorHash, 123);
  assert.equal(events[0].payload.argCount, 2);
  assert.equal(events[0].payload.opcode, 0x83);
});

test("execution profiler records gc and backend events", () => {
  const profiler = createExecutionProfiler({ metadata: { vmId: "vm-1" } });

  profiler.recordGC({ kind: "full", reason: "stress", durationMs: 42, stats: { previousNew: 10 } });
  profiler.recordBackendSwitch({ previous: "js", next: "managed", requested: "managed" });

  const events = profiler.getEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "gc");
  assert.equal(events[0].payload.kind, "full");
  assert.equal(events[0].payload.reason, "stress");
  assert.equal(events[0].payload.stats.previousNew, 10);
  assert.equal(events[0].payload.vmId, "vm-1");

  assert.equal(events[1].type, "backend");
  assert.equal(events[1].payload.previous, "js");
  assert.equal(events[1].payload.next, "managed");
});

test("execution profiler supports flush and summarize", () => {
  const profiler = createExecutionProfiler();
  const hooks = profiler.createDispatchHooks();

  hooks.onPrimitiveCall({ index: 42 });
  profiler.recordGC({ kind: "partial" });

  const summary = profiler.summarize();
  assert.equal(summary.totalEvents, 2);
  assert.equal(summary.typeCounts.primitive, 1);
  assert.equal(summary.typeCounts.gc, 1);

  const drained = profiler.flush();
  assert.equal(drained.length, 2);
  assert.equal(profiler.getEvents().length, 0);
});
