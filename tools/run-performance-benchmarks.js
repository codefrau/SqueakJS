#!/usr/bin/env node
"use strict";

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { benchmarkCatalog, runBenchmarkCatalog } from "../benchmark/catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const options = {
    output: "dist/telemetry/benchmarks.json",
    json: false,
    silent: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--output":
      case "-o":
        options.output = argv[++index] || options.output;
        break;
      case "--json":
        options.json = true;
        break;
      case "--silent":
        options.silent = true;
        break;
      default:
        break;
    }
  }
  return options;
}

function ensureDirectory(filePath) {
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

function formatBenchmark(benchmark) {
  const parts = [`- ${benchmark.label} (${benchmark.id})`];
  if (Array.isArray(benchmark.samples)) {
    for (const sample of benchmark.samples) {
      const backend = sample.backend || "unknown";
      const metricName = benchmark.primaryMetric || "opsPerSecond";
      const metricValue = sample[metricName];
      if (Number.isFinite(metricValue)) {
        parts.push(`    ${backend}: ${metricValue.toFixed(2)} ${benchmark.unit}`);
      } else {
        parts.push(`    ${backend}: n/a`);
      }
    }
  }
  if (benchmark.metadata && benchmark.metadata.improvementRatio != null) {
    parts.push(`    improvement: ${benchmark.metadata.improvementRatio.toFixed(2)}x`);
  }
  return parts.join("\n");
}

export async function runPerformanceBenchmarksCommand(argv = process.argv.slice(2), io = process) {
  const options = parseArgs(argv);
  const result = await runBenchmarkCatalog();

  if (options.output) {
    const outputPath = resolve(__dirname, "..", options.output);
    ensureDirectory(outputPath);
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    io.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (!options.silent) {
    io.stdout.write("Performance benchmark summary:\n");
    for (const benchmark of result.benchmarks) {
      io.stdout.write(`${formatBenchmark(benchmark)}\n`);
    }
  }

  return result;
}

export function listBenchmarkIdentifiers() {
  return benchmarkCatalog.map((entry) => entry.id);
}

if (process.argv[1] === __filename) {
  runPerformanceBenchmarksCommand().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
