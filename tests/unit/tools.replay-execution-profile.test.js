import test from "node:test";
import assert from "node:assert/strict";

import {
  parseExecutionProfile,
  summarizeExecutionProfile,
  buildFlamegraph
} from "../../tools/replay-execution-profile.js";

test("parseExecutionProfile handles arrays and wrapped payloads", () => {
  const sample = JSON.stringify({ events: [{ type: "send", payload: { selector: "foo" } }] });
  const parsed = parseExecutionProfile(sample);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, "send");

  const nested = parseExecutionProfile({ profile: { events: [{ type: "gc" }] } });
  assert.equal(nested.length, 1);
  assert.equal(nested[0].type, "gc");
});

test("summarizeExecutionProfile aggregates selectors and primitives", () => {
  const events = [
    { type: "send", payload: { selector: "foo" } },
    { type: "send", payload: { selectorId: "bar" } },
    { type: "primitive", payload: { index: 42 } }
  ];
  const summary = summarizeExecutionProfile(events);
  assert.equal(summary.totalEvents, 3);
  assert.equal(summary.typeCounts.send, 2);
  assert.equal(summary.sendSelectors.foo, 1);
  assert.equal(summary.sendSelectors.bar, 1);
  assert.equal(summary.primitiveCounts[42], 1);
});

test("buildFlamegraph collapses events into stacks", () => {
  const events = [
    { type: "send", payload: { selector: "foo" } },
    { type: "primitive", payload: { index: 7 } },
    { type: "gc", payload: { kind: "full" } }
  ];
  const flame = buildFlamegraph(events).split("\n");
  assert.ok(flame.some((line) => line.startsWith("execution;send:foo")));
  assert.ok(flame.some((line) => line.startsWith("execution;primitive:7")));
  assert.ok(flame.some((line) => line.startsWith("execution;gc:full")));
});
