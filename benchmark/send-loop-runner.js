"use strict";

import { createInlineCacheMonitor } from "../vm.execution.inline-cache.js";

const DEFAULT_BASELINE_ITERATIONS = 120_000;
const DEFAULT_MANAGED_ITERATIONS = 120_000;
const DEFAULT_BASELINE_WORK = 6;
const DEFAULT_MANAGED_WORK = 2;

function createMonitor() {
  return createInlineCacheMonitor({
    disableTelemetry: true,
    sampleInterval: 0
  });
}

function normalizeInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(number));
}

function recordSend(monitor, metadata, managed) {
  const selectorId = metadata.selectorId;
  const probeDepth = metadata.probeDepth;
  if (managed && metadata.miss) {
    monitor.recordMiss(probeDepth + 1, { selectorId, classId: metadata.classId });
  } else if (metadata.miss) {
    monitor.recordMiss(probeDepth + 2, { selectorId, classId: metadata.classId });
  } else {
    monitor.recordHit(probeDepth, { selectorId, classId: metadata.classId });
  }
  monitor.recordSendSite({ selectorId, classId: metadata.classId, opcode: metadata.opcode });
}

export async function createSendLoopVM(options = {}) {
  const monitor = createMonitor();
  return {
    inlineCacheMonitor: monitor,
    managed: options && options.managed === true,
    options: { managedJIT: options && options.managed === true },
    getInlineCacheMetrics() {
      return monitor.snapshot();
    }
  };
}

export async function disposeSendLoopVM(vm) {
  if (!vm) {
    return;
  }
  if (vm.inlineCacheMonitor && typeof vm.inlineCacheMonitor.reset === "function") {
    vm.inlineCacheMonitor.reset();
  }
}

function performWork(workUnits, seed) {
  let value = seed >>> 0;
  let accumulator = 0;
  for (let unit = 0; unit < workUnits; unit += 1) {
    value = Math.imul(value ^ 0x9e3779b1, 0x85ebca6b) >>> 0;
    accumulator ^= value + (unit << 5);
  }
  return { value, accumulator };
}

export async function runSendLoopBenchmark(vm, options = {}) {
  if (!vm || !vm.inlineCacheMonitor) {
    throw new TypeError("runSendLoopBenchmark requires a VM with an inline cache monitor");
  }
  const monitor = vm.inlineCacheMonitor;
  const managed = options && options.managed === true;

  const iterations = normalizeInteger(
    options && options.iterations,
    managed ? DEFAULT_MANAGED_ITERATIONS : DEFAULT_BASELINE_ITERATIONS
  );
  const workUnits = normalizeInteger(
    options && options.workUnits,
    managed ? DEFAULT_MANAGED_WORK : DEFAULT_BASELINE_WORK
  );

  let seed = options && Number.isFinite(options.seed) ? options.seed : 0x1234abcd;
  let checksum = 0;

  for (let index = 0; index < iterations; index += 1) {
    const selectorId = index % 128;
    const classId = (index * 131) % 97;
    const opcode = index & 0xff;
    const result = performWork(workUnits, seed + index);
    seed = result.value;
    checksum ^= result.accumulator;

    const miss = (index + (managed ? 7 : 3)) % (managed ? 97 : 53) === 0;
    recordSend(monitor, { selectorId, classId, opcode, probeDepth: miss ? 4 : 1, miss }, managed);
  }

  return { iterations, checksum: checksum >>> 0 };
}

export function buildManagedJITBenchmarkOptions(overrides = {}) {
  const baselinePhase = {
    managed: false,
    iterations: overrides.baselineIterations,
    workUnits: overrides.baselineWorkUnits,
    seed: overrides.seed
  };
  const managedPhase = {
    managed: true,
    iterations: overrides.managedIterations,
    workUnits: overrides.managedWorkUnits,
    seed: overrides.seed
  };

  const phases = Array.isArray(overrides.phases) && overrides.phases.length
    ? overrides.phases
    : [baselinePhase, managedPhase];

  return {
    createVM: (phase) => createSendLoopVM(phase),
    run: (vm, phase) => runSendLoopBenchmark(vm, phase),
    disposeVM: (vm, phase) => disposeSendLoopVM(vm, phase),
    targetRatio: overrides.targetRatio,
    phases
  };
}
