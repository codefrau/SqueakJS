import test from "node:test";
import assert from "node:assert/strict";

import {
  createSendLoopVM,
  disposeSendLoopVM,
  runSendLoopBenchmark,
  buildManagedJITBenchmarkOptions
} from "../../benchmark/send-loop-runner.js";
import { runManagedJITSendBenchmark } from "../../vm.execution.jit.benchmark.js";

test("runSendLoopBenchmark records inline cache metrics", async () => {
  const vm = await createSendLoopVM({ managed: false });
  try {
    const outcome = await runSendLoopBenchmark(vm, { iterations: 200, workUnits: 4 });
    const metrics = vm.getInlineCacheMetrics();
    assert.equal(outcome.iterations, 200);
    assert.ok(metrics.lookups >= 200);
    assert.ok(metrics.hits + metrics.misses >= 200);
  } finally {
    await disposeSendLoopVM(vm);
  }
});

test("buildManagedJITBenchmarkOptions integrates with managed benchmark harness", async () => {
  const clockValues = [0, 40, 45, 60];
  const now = () => {
    const value = clockValues.shift();
    return value != null ? value : clockValues[clockValues.length - 1] || 0;
  };

  const options = buildManagedJITBenchmarkOptions({
    baselineIterations: 200,
    managedIterations: 200,
    baselineWorkUnits: 8,
    managedWorkUnits: 2,
    targetRatio: 1.5,
    seed: 0x100
  });

  const result = await runManagedJITSendBenchmark({ ...options, now });
  assert.ok(result.meetsTarget, "managed JIT benchmark should meet the configured target ratio");
  assert.ok(result.improvementRatio >= 1.5);
  assert.equal(result.phases.length, 2);
});
