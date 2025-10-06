import test from "node:test";
import assert from "node:assert/strict";

import {
  runManagedJITSendBenchmark,
  snapshotManagedJITSends
} from "../../vm.execution.jit.benchmark.js";

test("snapshotManagedJITSends prioritizes inline cache monitor metrics", () => {
  const vm = {
    inlineCacheMonitor: {
      snapshot() {
        return { lookups: 1200, hits: 900, misses: 300, evictions: 12 };
      }
    },
    getInlineCacheMetrics() {
      return { lookups: 10, hits: 1, misses: 9 };
    },
    sendCount: 5
  };

  const snapshot = snapshotManagedJITSends(vm);
  assert.deepEqual(snapshot, { total: 1200, hits: 900, misses: 300, evictions: 12 });
});

test("snapshotManagedJITSends falls back to sendCount when necessary", () => {
  const vm = { sendCount: 42 };
  const snapshot = snapshotManagedJITSends(vm);
  assert.deepEqual(snapshot, { total: 42, hits: 0, misses: 0, evictions: 0 });
});

test("runManagedJITSendBenchmark measures improvement ratios across phases", async () => {
  const times = [0, 50, 100, 160];
  let callIndex = 0;
  let baselineLookups = 0;
  let managedLookups = 0;

  const report = await runManagedJITSendBenchmark({
    targetRatio: 2,
    now: () => times[callIndex++],
    async createVM(phase) {
      return {
        inlineCacheMonitor: {
          snapshot() {
            if (phase.managed) {
              return { lookups: managedLookups, hits: managedLookups * 0.8, misses: managedLookups * 0.2 };
            }
            return { lookups: baselineLookups, hits: baselineLookups * 0.5, misses: baselineLookups * 0.5 };
          }
        }
      };
    },
    async run(vm, phase) {
      if (phase.managed) {
        managedLookups += 6000;
      } else {
        baselineLookups += 1000;
      }
      return { phase: phase.managed ? "managed" : "baseline" };
    }
  });

  assert.equal(report.phases.length, 2);
  assert.equal(report.baseline.metrics.total, 1000);
  assert.equal(report.managed.metrics.total, 6000);
  assert.ok(report.improvementRatio > 0);
  assert.equal(report.improvementRatio.toFixed(2), "5.00");
  assert.equal(report.meetsTarget, true);
  assert.equal(report.baseline.result.phase, "baseline");
  assert.equal(report.managed.result.phase, "managed");
});

test("runManagedJITSendBenchmark handles explicit phase ordering", async () => {
  const times = [0, 75, 100, 175, 200, 260];
  let callIndex = 0;
  let lookups = 0;

  const report = await runManagedJITSendBenchmark({
    now: () => times[callIndex++],
    phases: [{ label: "warmup", managed: false }, { managed: true }, { label: "baseline" }],
    async createVM() {
      return {
        getInlineCacheMetrics() {
          return { lookups };
        }
      };
    },
    async run(vm, phase) {
      lookups += phase.managed ? 4000 : 1000;
      vm.phaseLabel = phase.label;
    },
    async disposeVM(vm) {
      vm.phaseLabel = null;
    }
  });

  assert.equal(report.phases.length, 3);
  assert.equal(report.baseline.metrics.total, 1000);
  assert.equal(report.managed.metrics.total, 4000);
  assert.equal(report.meetsTarget, true);
  assert.equal(report.targetRatio, 2);
});

test("runManagedJITSendBenchmark validates options", async () => {
  await assert.rejects(() => runManagedJITSendBenchmark(null), /Benchmark options/);
  await assert.rejects(() => runManagedJITSendBenchmark({}), /createVM option/);
  await assert.rejects(
    () => runManagedJITSendBenchmark({ createVM: async () => ({}) }),
    /run option/
  );
});
