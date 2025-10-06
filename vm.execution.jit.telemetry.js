"use strict";

import {
  configureTelemetryChannel,
  emitTelemetryEvent,
  getTelemetryChannelState,
  resetTelemetryChannels
} from "./vm.telemetry.channel.js";
import { runManagedJITSendBenchmark } from "./vm.execution.jit.benchmark.js";

export const MANAGED_JIT_BENCHMARK_NAMESPACE = "execution.jit.benchmark";
const DEFAULT_TELEMETRY_VERSION = 1;

function ensureChannel(config) {
  if (config && typeof config === "object") {
    return configureTelemetryChannel(MANAGED_JIT_BENCHMARK_NAMESPACE, {
      version: config.version,
      bufferLimit: config.bufferLimit
    });
  }
  return configureTelemetryChannel(MANAGED_JIT_BENCHMARK_NAMESPACE);
}

function clampNonNegative(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return number;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function computeRate(numerator, denominator) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
    return null;
  }
  return num / den;
}

function sanitizePhaseOptions(options) {
  if (!options || typeof options !== "object") {
    return null;
  }
  const payload = {};
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      payload[key] = value;
    }
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

function sanitizePhase(phase) {
  if (!phase || typeof phase !== "object") {
    return {
      mode: "unknown",
      durationMs: 0,
      sendsPerSecond: 0,
      metrics: { total: 0, hits: 0, misses: 0, evictions: 0 },
      options: null
    };
  }
  const metrics = phase.metrics && typeof phase.metrics === "object" ? phase.metrics : {};
  return {
    mode: typeof phase.mode === "string" && phase.mode ? phase.mode : "unknown",
    durationMs: clampNonNegative(phase.durationMs),
    sendsPerSecond: clampNonNegative(phase.sendsPerSecond),
    metrics: {
      total: clampNonNegative(metrics.total),
      hits: clampNonNegative(metrics.hits),
      misses: clampNonNegative(metrics.misses),
      evictions: clampNonNegative(metrics.evictions)
    },
    options: sanitizePhaseOptions(phase.phase)
  };
}

function extractPhase(list, mode) {
  if (!Array.isArray(list)) {
    return null;
  }
  return list.find((item) => item && item.mode === mode) || null;
}

function buildMetrics(sanitized) {
  const metrics = {};
  const baseline = sanitized.baseline;
  const managed = sanitized.managed;

  if (sanitized.improvementRatio !== null) {
    metrics.improvementRatio = sanitized.improvementRatio;
  }
  if (sanitized.targetRatio !== null) {
    metrics.targetRatio = sanitized.targetRatio;
  }

  if (baseline) {
    metrics.baselineSendsPerSecond = baseline.sendsPerSecond;
    metrics.baselineDurationMs = baseline.durationMs;
    metrics.baselineTotalSends = baseline.metrics.total;
    const missRate = computeRate(baseline.metrics.misses, baseline.metrics.total);
    if (missRate !== null) {
      metrics.baselineMissRate = missRate;
    }
  }

  if (managed) {
    metrics.managedSendsPerSecond = managed.sendsPerSecond;
    metrics.managedDurationMs = managed.durationMs;
    metrics.managedTotalSends = managed.metrics.total;
    const missRate = computeRate(managed.metrics.misses, managed.metrics.total);
    if (missRate !== null) {
      metrics.managedMissRate = missRate;
    }
  }

  if (baseline && managed) {
    const deltaSends = managed.sendsPerSecond - baseline.sendsPerSecond;
    if (Number.isFinite(deltaSends)) {
      metrics.deltaSendsPerSecond = deltaSends;
    }
    const baselineMiss = computeRate(baseline.metrics.misses, baseline.metrics.total);
    const managedMiss = computeRate(managed.metrics.misses, managed.metrics.total);
    if (baselineMiss !== null && managedMiss !== null) {
      metrics.deltaMissRate = managedMiss - baselineMiss;
    }
  }

  return metrics;
}

function sanitizeBenchmarkResult(result) {
  if (!result || typeof result !== "object") {
    throw new TypeError("Managed JIT benchmark result must be provided");
  }

  const phases = Array.isArray(result.phases) ? result.phases.map(sanitizePhase) : [];
  let baseline = result.baseline ? sanitizePhase(result.baseline) : extractPhase(phases, "baseline");
  if (!baseline) {
    baseline = sanitizePhase(null);
  }
  let managed = result.managed ? sanitizePhase(result.managed) : extractPhase(phases, "managed");
  if (!managed) {
    managed = sanitizePhase(null);
  }

  const sanitized = {
    generatedAt: Date.now(),
    meetsTarget: result.meetsTarget === true,
    targetRatio: finiteOrNull(result.targetRatio),
    improvementRatio: finiteOrNull(result.improvementRatio),
    phases,
    baseline,
    managed
  };

  sanitized.metrics = buildMetrics(sanitized);
  return sanitized;
}

export function recordManagedJITBenchmark(result, options = {}) {
  const telemetryConfig = options.channel || options.telemetry;
  ensureChannel(telemetryConfig);

  const sanitized = sanitizeBenchmarkResult(result);

  const payload = {
    runId: options.runId || (options.metadata && options.metadata.runId) || null,
    source: options.source || (options.metadata && options.metadata.source) || null,
    meetsTarget: sanitized.meetsTarget,
    targetRatio: sanitized.targetRatio,
    improvementRatio: sanitized.improvementRatio,
    metrics: sanitized.metrics,
    phases: sanitized.phases,
    generatedAt: sanitized.generatedAt
  };

  if (!payload.runId && options.metadata && options.metadata.id) {
    payload.runId = options.metadata.id;
  }
  if (options.metadata && options.metadata.notes) {
    payload.notes = options.metadata.notes;
  }

  const eventOptions = {
    version: options.version || (telemetryConfig && telemetryConfig.version) || DEFAULT_TELEMETRY_VERSION,
    tags: options.tags || (options.metadata && options.metadata.tags) || undefined,
    context: options.context || (options.metadata && options.metadata.context) || undefined,
    dedupeKey: options.dedupeKey || payload.runId || undefined,
    fallbackLevel: options.fallbackLevel,
    consolePrefix: options.consolePrefix
  };

  emitTelemetryEvent(
    MANAGED_JIT_BENCHMARK_NAMESPACE,
    options.eventType || "send-benchmark",
    payload,
    eventOptions
  );

  return payload;
}

export async function runManagedJITBenchmarkWithTelemetry(benchmarkOptions = {}, telemetryOptions = {}) {
  const result = await runManagedJITSendBenchmark(benchmarkOptions);
  recordManagedJITBenchmark(result, telemetryOptions);
  return result;
}

export function resetManagedJITBenchmarkTelemetry(config) {
  if (config) {
    ensureChannel(config);
  }
  resetTelemetryChannels(MANAGED_JIT_BENCHMARK_NAMESPACE);
}

export function configureManagedJITBenchmarkTelemetry(config) {
  return ensureChannel(config);
}

export function getManagedJITBenchmarkTelemetryState() {
  ensureChannel();
  return getTelemetryChannelState(MANAGED_JIT_BENCHMARK_NAMESPACE);
}

