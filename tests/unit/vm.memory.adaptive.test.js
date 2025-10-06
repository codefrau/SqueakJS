import test from "node:test";
import assert from "node:assert/strict";

import { startAdaptiveMemoryManager } from "../../vm.memory.adaptive.js";
import { createMemorySnapshot, MB } from "../fixtures/vm.js";

test("falls back to policy guardrails when image hooks are missing", () => {
  const image = {
    headRoom: 60 * MB,
    oldSpaceBytes: 140 * MB,
    totalMemory: 200 * MB,
    memoryPolicy: { headroomBytes: 60 * MB, lowSpaceBytes: 4 * MB },
    captureMemorySnapshot(reason) {
      this.snapshotReasons.push(reason);
      return this.snapshots.shift();
    },
    snapshots: [
      createMemorySnapshot({ headroomMB: 60, freeMB: 40, youngMB: 10, newMB: 8, hostUsedMB: 170, hostLimitMB: 180 }),
      createMemorySnapshot({ headroomMB: 48, freeMB: 34, youngMB: 8, newMB: 6, hostUsedMB: 170, hostLimitMB: 180 }),
    ],
    snapshotReasons: [],
    fullGC(reason) {
      this.fullGCReasons.push(reason);
      return true;
    },
    fullGCReasons: [],
    _finalizeMemoryPolicyAfterLoad() {
      this.finalized = true;
    },
    _syncLowSpaceMonitor() {
      this.synced = true;
    },
  };

  const vm = { image };
  const manager = startAdaptiveMemoryManager(vm, { memoryAdaptive: { intervalMs: 0, shrinkStepMB: 12, gcThrottleMs: 0 } });
  assert.ok(manager.guardrails.headroomStrategy === "policy-fallback", "headroom guardrail should note fallback strategy");
  assert.ok(manager.guardrails.gcStrategy.startsWith("full"), "gc guardrail should fall back to full collection");

  manager.poke("test");
  assert.ok(image.finalized, "fallback should finalize memory policy after adjustment");
  assert.ok(image.synced, "fallback should sync low-space monitor");
  assert.ok(image.fullGCReasons.length >= 1, "fallback should trigger full GC under pressure");
  assert.strictEqual(manager.lastDecision.action, "shrink", "manager should shrink headroom");
  assert.ok(manager.lastDecision.gcTriggered, "decision should record GC trigger");
  assert.ok(image.memoryPolicy.headroomBytes < 60 * MB, "headroom bytes should be reduced");
});

