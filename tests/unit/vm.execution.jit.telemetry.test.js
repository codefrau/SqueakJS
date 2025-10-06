import test from "node:test";
import assert from "node:assert/strict";

import {
  configureManagedJITBenchmarkTelemetry,
  getManagedJITBenchmarkTelemetryState,
  MANAGED_JIT_BENCHMARK_NAMESPACE,
  recordManagedJITBenchmark,
  resetManagedJITBenchmarkTelemetry,
  runManagedJITBenchmarkWithTelemetry
} from "../../vm.execution.jit.telemetry.js";

function buildBenchmarkResult(overrides = {}) {
  const baselinePhase = {
    mode: "baseline",
    durationMs: 12,
    sendsPerSecond: 800,
    metrics: { total: 9600, hits: 7200, misses: 2400, evictions: 60 },
    phase: { managed: false }
  };
  const managedPhase = {
    mode: "managed",
    durationMs: 9,
    sendsPerSecond: 2200,
    metrics: { total: 19800, hits: 18200, misses: 1600, evictions: 90 },
    phase: { managed: true }
  };
  return {
    phases: [baselinePhase, managedPhase],
    baseline: baselinePhase,
    managed: managedPhase,
    improvementRatio: 2.75,
    targetRatio: 2,
    meetsTarget: true,
    ...overrides
  };
}

test("recordManagedJITBenchmark emits telemetry with sanitized metrics", () => {
  resetManagedJITBenchmarkTelemetry({ version: 5 });

  const payload = recordManagedJITBenchmark(buildBenchmarkResult(), {
    runId: "ci-run-123",
    tags: { suite: "micro" },
    context: { branch: "main" },
    version: 5
  });

  assert.equal(payload.runId, "ci-run-123");
  assert.equal(payload.meetsTarget, true);
  assert.equal(payload.targetRatio, 2);
  assert.equal(payload.improvementRatio, 2.75);
  assert.ok(payload.metrics);
  assert.equal(payload.metrics.baselineSendsPerSecond, 800);
  assert.equal(payload.metrics.managedSendsPerSecond, 2200);
  assert.ok(payload.metrics.deltaSendsPerSecond > 0);

  const state = getManagedJITBenchmarkTelemetryState();
  assert.ok(state);
  assert.equal(state.namespace, MANAGED_JIT_BENCHMARK_NAMESPACE);
  assert.equal(state.version, 5);
  assert.equal(state.history.length, 1);
  const event = state.history[0];
  assert.equal(event.type, "send-benchmark");
  assert.deepEqual(event.tags, { suite: "micro" });
  assert.deepEqual(event.context, { branch: "main" });
  assert.equal(event.payload.runId, "ci-run-123");
  assert.equal(event.payload.metrics.baselineTotalSends, 9600);
  assert.equal(event.payload.metrics.managedTotalSends, 19800);
});

test("runManagedJITBenchmarkWithTelemetry executes harness and records telemetry", async () => {
  resetManagedJITBenchmarkTelemetry();
  configureManagedJITBenchmarkTelemetry({ version: 2, bufferLimit: 10 });

  let counter = 0;
  function now() {
    counter += 5;
    return counter;
  }

  const vmFactory = async () => {
    let total = 0;
    let hits = 0;
    let misses = 0;
    return {
      inlineCacheMonitor: {
        snapshot() {
          return { total, hits, misses, evictions: 0 };
        }
      },
      record(count, hitCount, missCount) {
        total += count;
        hits += hitCount;
        misses += missCount;
      }
    };
  };

  const result = await runManagedJITBenchmarkWithTelemetry(
    {
      createVM: async (phase) => {
        const vm = await vmFactory();
        vm.phase = phase;
        return vm;
      },
      run: async (vm, phase) => {
        if (phase.managed) {
          vm.record(1500, 1300, 200);
        } else {
          vm.record(600, 450, 150);
        }
        return phase;
      },
      disposeVM: async () => {},
      now
    },
    { runId: "auto" }
  );

  assert.ok(result);
  assert.equal(result.phases.length, 2);
  assert.equal(result.baseline.mode, "baseline");
  assert.equal(result.managed.mode, "managed");

  const telemetry = getManagedJITBenchmarkTelemetryState();
  assert.equal(telemetry.history.length, 1);
  const event = telemetry.history[0];
  assert.equal(event.payload.runId, "auto");
  assert.equal(event.payload.metrics.baselineTotalSends, 600);
  assert.equal(event.payload.metrics.managedTotalSends, 1500);
});

test("recordManagedJITBenchmark tolerates partial results", () => {
  resetManagedJITBenchmarkTelemetry();
  const payload = recordManagedJITBenchmark({ phases: [] });
  assert.equal(payload.meetsTarget, false);
  assert.equal(payload.targetRatio, null);
  assert.equal(payload.metrics.baselineTotalSends, 0);

  const telemetry = getManagedJITBenchmarkTelemetryState();
  assert.equal(telemetry.history.length, 1);
});

