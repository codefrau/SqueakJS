#!/usr/bin/env node
"use strict";

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const options = {
    baseline: null,
    candidate: null,
    threshold: 0.1,
    silent: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--baseline":
        options.baseline = argv[++index] || null;
        break;
      case "--candidate":
        options.candidate = argv[++index] || null;
        break;
      case "--threshold":
        options.threshold = Number(argv[++index]);
        break;
      case "--silent":
        options.silent = true;
        break;
      default:
        break;
    }
  }
  if (!options.baseline || !options.candidate) {
    throw new Error("compare-performance-benchmarks requires --baseline and --candidate inputs");
  }
  if (!Number.isFinite(options.threshold) || options.threshold < 0) {
    options.threshold = 0.1;
  }
  return options;
}

function loadBenchmarks(filePath) {
  const absolutePath = resolve(__dirname, "..", filePath);
  const content = readFileSync(absolutePath, "utf8");
  const data = JSON.parse(content);
  return Array.isArray(data.benchmarks) ? data.benchmarks : [];
}

function indexBenchmarks(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string") continue;
    map.set(entry.id, entry);
  }
  return map;
}

function indexSamples(benchmark) {
  const map = new Map();
  if (!benchmark || !Array.isArray(benchmark.samples)) {
    return map;
  }
  for (const sample of benchmark.samples) {
    const backend = sample.backend || "default";
    map.set(backend, sample);
  }
  return map;
}

function extractMetric(benchmark, sample) {
  if (!benchmark || !sample) {
    return null;
  }
  const metric = benchmark.primaryMetric || "opsPerSecond";
  const value = sample[metric];
  return Number.isFinite(value) ? value : null;
}

function formatRegression({ benchmarkId, backend, baselineValue, candidateValue, threshold }) {
  const delta = baselineValue === 0 ? 0 : (baselineValue - candidateValue) / baselineValue;
  const deltaPercent = (delta * 100).toFixed(2);
  return `- ${benchmarkId} (${backend}) regressed by ${deltaPercent}% (threshold ${
    (threshold * 100).toFixed(2)
  }%) [baseline=${baselineValue.toFixed(2)}, candidate=${candidateValue.toFixed(2)}]`;
}

export function compareBenchmarks(baselineEntries, candidateEntries, threshold = 0.1) {
  const baselineIndex = indexBenchmarks(baselineEntries);
  const candidateIndex = indexBenchmarks(candidateEntries);
  const regressions = [];

  for (const [benchmarkId, baselineBenchmark] of baselineIndex.entries()) {
    const candidateBenchmark = candidateIndex.get(benchmarkId);
    if (!candidateBenchmark) continue;
    const baselineSamples = indexSamples(baselineBenchmark);
    const candidateSamples = indexSamples(candidateBenchmark);
    for (const [backend, baselineSample] of baselineSamples.entries()) {
      const candidateSample = candidateSamples.get(backend);
      if (!candidateSample) continue;
      const baselineValue = extractMetric(baselineBenchmark, baselineSample);
      const candidateValue = extractMetric(candidateBenchmark, candidateSample);
      if (baselineValue == null || candidateValue == null) continue;
      if (baselineValue === 0) continue;
      const ratio = candidateValue / baselineValue;
      if (ratio >= 1) continue;
      if (baselineSample.iterations && candidateSample.iterations && candidateSample.iterations < baselineSample.iterations) {
        // Skip comparisons with fewer iterations; not statistically comparable
        continue;
      }
      const delta = (baselineValue - candidateValue) / baselineValue;
      if (delta > threshold) {
        regressions.push({ benchmarkId, backend, baselineValue, candidateValue, threshold });
      }
    }
  }
  return regressions;
}

export async function comparePerformanceBenchmarksCommand(argv = process.argv.slice(2), io = process) {
  const options = parseArgs(argv);
  const baseline = loadBenchmarks(options.baseline);
  const candidate = loadBenchmarks(options.candidate);
  const regressions = compareBenchmarks(baseline, candidate, options.threshold);

  if (!options.silent) {
    if (regressions.length === 0) {
      io.stdout.write("No performance regressions detected.\n");
    } else {
      io.stdout.write("Performance regressions detected:\n");
      for (const regression of regressions) {
        io.stdout.write(`${formatRegression(regression)}\n`);
      }
    }
  }

  if (regressions.length > 0) {
    process.exitCode = 1;
  }

  return regressions;
}

if (process.argv[1] === __filename) {
  comparePerformanceBenchmarksCommand().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
