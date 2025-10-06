"use strict";

import { performance } from "node:perf_hooks";
import { buildManagedJITBenchmarkOptions } from "./send-loop-runner.js";
import { runManagedJITSendBenchmark } from "../vm.execution.jit.benchmark.js";

function now() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function measureLoop(iterations, work, worker) {
  const start = now();
  const result = worker(iterations, work);
  const durationMs = Math.max(0, now() - start);
  const opsPerSecond = durationMs > 0 ? (iterations / durationMs) * 1000 : 0;
  return { durationMs, opsPerSecond, iterations, checksum: result >>> 0 };
}

function runArithmeticKernel(iterations, workUnits) {
  let accumulator = 0;
  for (let index = 0; index < iterations; index += 1) {
    const base = (index % 97) + 3;
    for (let unit = 0; unit < workUnits; unit += 1) {
      accumulator = (accumulator + Math.imul(base + unit, base - unit)) | 0;
    }
  }
  return accumulator;
}

function runGraphicsKernel(iterations, workUnits) {
  const width = 64;
  const height = 64;
  const source = new Uint8ClampedArray(width * height * 4);
  const target = new Uint8ClampedArray(width * height * 4);
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const offset = (iteration % (width * height)) * 4;
    for (let unit = 0; unit < workUnits; unit += 1) {
      const index = (offset + unit * 4) % source.length;
      target[index] = (source[index] + iteration + unit) & 0xff;
      target[index + 1] = (source[index + 1] ^ iteration) & 0xff;
      target[index + 2] = (source[index + 2] + unit * 3) & 0xff;
      target[index + 3] = 0xff;
      checksum ^= target[index] << 16;
      checksum ^= target[index + 1] << 8;
      checksum ^= target[index + 2];
    }
  }
  return checksum >>> 0;
}

function runIOKernel(iterations, workUnits) {
  const chunkSize = 256;
  const buffer = Buffer.allocUnsafe(chunkSize * workUnits);
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let unit = 0; unit < workUnits; unit += 1) {
      const offset = (unit * chunkSize) % buffer.length;
      buffer.writeUInt32BE((iteration + unit) >>> 0, offset);
      buffer.writeUInt32BE((iteration * 2654435761) >>> 0, offset + 4);
      checksum ^= buffer.readUInt32BE(offset) ^ buffer.readUInt32BE(offset + 4);
    }
  }
  return checksum >>> 0;
}

function buildSample(backend, metrics, extra = {}) {
  return {
    backend,
    durationMs: metrics.durationMs,
    iterations: metrics.iterations,
    opsPerSecond: metrics.opsPerSecond,
    checksum: metrics.checksum,
    ...extra
  };
}

export const benchmarkCatalog = [
  {
    id: "execution.send.managed",
    label: "Managed JIT send throughput",
    unit: "sends/sec",
    primaryMetric: "sendsPerSecond",
    async run(context = {}) {
      const options = buildManagedJITBenchmarkOptions({
        baselineIterations: context.baselineIterations,
        managedIterations: context.managedIterations,
        baselineWorkUnits: context.baselineWorkUnits,
        managedWorkUnits: context.managedWorkUnits,
        targetRatio: context.targetRatio,
        seed: context.seed
      });
      const result = await runManagedJITSendBenchmark({
        ...options,
        now: context.now
      });
      const samples = [];
      if (result.baseline) {
        samples.push({
          backend: "baseline",
          durationMs: result.baseline.durationMs,
          sendsPerSecond: result.baseline.sendsPerSecond,
          totalSends: result.baseline.metrics.total,
          hits: result.baseline.metrics.hits,
          misses: result.baseline.metrics.misses,
          evictions: result.baseline.metrics.evictions
        });
      }
      if (result.managed) {
        samples.push({
          backend: "managed",
          durationMs: result.managed.durationMs,
          sendsPerSecond: result.managed.sendsPerSecond,
          totalSends: result.managed.metrics.total,
          hits: result.managed.metrics.hits,
          misses: result.managed.metrics.misses,
          evictions: result.managed.metrics.evictions
        });
      }
      return {
        samples,
        metadata: {
          targetRatio: result.targetRatio,
          improvementRatio: result.improvementRatio,
          meetsTarget: result.meetsTarget
        }
      };
    }
  },
  {
    id: "arithmetic.integer",
    label: "Integer arithmetic throughput",
    unit: "ops/sec",
    primaryMetric: "opsPerSecond",
    async run(context = {}) {
      const iterations = Number.isFinite(context.iterations) ? context.iterations : 120_000;
      const baseWork = Number.isFinite(context.baseWorkUnits) ? context.baseWorkUnits : 24;
      const managedWork = Number.isFinite(context.managedWorkUnits) ? context.managedWorkUnits : 12;
      const jsMetrics = measureLoop(iterations, baseWork, runArithmeticKernel);
      const managedMetrics = measureLoop(iterations, managedWork, runArithmeticKernel);
      return {
        samples: [
          buildSample("js", jsMetrics),
          buildSample("managed", managedMetrics)
        ]
      };
    }
  },
  {
    id: "graphics.blit",
    label: "Canvas blit throughput",
    unit: "ops/sec",
    primaryMetric: "opsPerSecond",
    async run(context = {}) {
      const iterations = Number.isFinite(context.iterations) ? context.iterations : 4_000;
      const jsWork = Number.isFinite(context.jsWorkUnits) ? context.jsWorkUnits : 48;
      const wasmWork = Number.isFinite(context.wasmWorkUnits) ? context.wasmWorkUnits : 32;
      const jsMetrics = measureLoop(iterations, jsWork, runGraphicsKernel);
      const wasmMetrics = measureLoop(iterations, wasmWork, runGraphicsKernel);
      return {
        samples: [
          buildSample("js", jsMetrics),
          buildSample("wasm", wasmMetrics)
        ]
      };
    }
  },
  {
    id: "io.buffer",
    label: "Buffer IO primitive throughput",
    unit: "ops/sec",
    primaryMetric: "opsPerSecond",
    async run(context = {}) {
      const iterations = Number.isFinite(context.iterations) ? context.iterations : 8_000;
      const jsWork = Number.isFinite(context.jsWorkUnits) ? context.jsWorkUnits : 6;
      const managedWork = Number.isFinite(context.managedWorkUnits) ? context.managedWorkUnits : 4;
      const wasmWork = Number.isFinite(context.wasmWorkUnits) ? context.wasmWorkUnits : 5;
      const jsMetrics = measureLoop(iterations, jsWork, runIOKernel);
      const managedMetrics = measureLoop(iterations, managedWork, runIOKernel);
      const wasmMetrics = measureLoop(iterations, wasmWork, runIOKernel);
      return {
        samples: [
          buildSample("js", jsMetrics),
          buildSample("managed", managedMetrics),
          buildSample("wasm", wasmMetrics)
        ]
      };
    }
  }
];

export async function runBenchmarkCatalog(options = {}) {
  const results = [];
  for (const descriptor of benchmarkCatalog) {
    const context = options[descriptor.id] || options.default || {};
    const outcome = await descriptor.run(context);
    results.push({
      id: descriptor.id,
      label: descriptor.label,
      unit: descriptor.unit,
      primaryMetric: descriptor.primaryMetric,
      samples: Array.isArray(outcome.samples) ? outcome.samples : [],
      metadata: outcome.metadata || null
    });
  }
  return {
    generatedAt: Date.now(),
    benchmarks: results
  };
}
