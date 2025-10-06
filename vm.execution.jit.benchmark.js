"use strict";

const DEFAULT_TARGET_RATIO = 2;

function defaultNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function sanitizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sanitizeMetrics(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return { total: 0, hits: 0, misses: 0, evictions: 0 };
  }
  const total = sanitizeNumber(
    snapshot.lookups ?? snapshot.total ?? snapshot.totalLookups ?? snapshot.sends ?? snapshot.totalSends
  );
  const hits = sanitizeNumber(snapshot.hits ?? snapshot.hitCount);
  const misses = sanitizeNumber(snapshot.misses ?? snapshot.missCount);
  const evictions = sanitizeNumber(snapshot.evictions ?? snapshot.evictionCount);
  return { total, hits, misses, evictions };
}

function readSendSnapshot(vm) {
  if (!vm || typeof vm !== "object") {
    return { total: 0, hits: 0, misses: 0, evictions: 0 };
  }
  if (vm.inlineCacheMonitor && typeof vm.inlineCacheMonitor.snapshot === "function") {
    return sanitizeMetrics(vm.inlineCacheMonitor.snapshot());
  }
  if (typeof vm.getInlineCacheMetrics === "function") {
    return sanitizeMetrics(vm.getInlineCacheMetrics());
  }
  if (typeof vm.sendCount === "number") {
    return { total: sanitizeNumber(vm.sendCount), hits: 0, misses: 0, evictions: 0 };
  }
  return { total: 0, hits: 0, misses: 0, evictions: 0 };
}

function diffSendSnapshot(before, after) {
  const start = sanitizeMetrics(before);
  const end = sanitizeMetrics(after);
  const total = Math.max(0, end.total - start.total);
  const hits = Math.max(0, end.hits - start.hits);
  const misses = Math.max(0, end.misses - start.misses);
  const evictions = Math.max(0, end.evictions - start.evictions);
  return { total, hits, misses, evictions };
}

async function runPhase(createVM, run, disposeVM, phaseOptions, now) {
  const vm = await createVM(phaseOptions);
  try {
    const before = readSendSnapshot(vm);
    const startTime = now();
    const result = await run(vm, phaseOptions);
    const endTime = now();
    const after = readSendSnapshot(vm);
    const durationMs = Math.max(0, sanitizeNumber(endTime - startTime));
    const metrics = diffSendSnapshot(before, after);
    const sendsPerSecond = durationMs > 0 ? (metrics.total / durationMs) * 1000 : 0;
    return {
      mode: phaseOptions && phaseOptions.managed === true ? "managed" : "baseline",
      durationMs,
      metrics,
      sendsPerSecond,
      result
    };
  } finally {
    if (typeof disposeVM === "function") {
      await disposeVM(vm, phaseOptions);
    }
  }
}

export async function runManagedJITSendBenchmark(options = {}) {
  if (!options || typeof options !== "object") {
    throw new TypeError("Benchmark options must be provided as an object");
  }
  const { createVM, run, disposeVM, targetRatio, phases } = options;
  if (typeof createVM !== "function") {
    throw new TypeError("createVM option must be a function returning a VM instance");
  }
  if (typeof run !== "function") {
    throw new TypeError("run option must be a function that executes the microbenchmark");
  }
  const ratioTarget = Number.isFinite(targetRatio) && targetRatio > 0 ? targetRatio : DEFAULT_TARGET_RATIO;
  const clock = typeof options.now === "function" ? options.now : defaultNow;

  const phaseList = Array.isArray(phases) && phases.length
    ? phases.slice()
    : [{ managed: false }, { managed: true }];

  const executed = [];
  for (const phaseOptions of phaseList) {
    const phase = await runPhase(createVM, run, disposeVM, phaseOptions, clock);
    executed.push({ ...phase, phase: phaseOptions });
  }

  const baselinePhase = executed.find((phase) => phase.mode === "baseline") || executed[0];
  const managedPhase = executed.find((phase) => phase.mode === "managed") || executed[executed.length - 1];
  const improvement = baselinePhase && baselinePhase.sendsPerSecond > 0
    ? managedPhase.sendsPerSecond / baselinePhase.sendsPerSecond
    : null;

  return {
    phases: executed,
    baseline: baselinePhase,
    managed: managedPhase,
    improvementRatio: improvement,
    targetRatio: ratioTarget,
    meetsTarget: improvement !== null && improvement >= ratioTarget
  };
}

export function snapshotManagedJITSends(vm) {
  return readSendSnapshot(vm);
}
