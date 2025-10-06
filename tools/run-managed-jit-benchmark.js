#!/usr/bin/env node
"use strict";

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { buildManagedJITBenchmarkOptions } from "../benchmark/send-loop-runner.js";
import { runManagedJITBenchmarkWithTelemetry } from "../vm.execution.jit.telemetry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const options = {
    output: null,
    json: false,
    targetRatio: null,
    baselineIterations: null,
    managedIterations: null,
    baselineWorkUnits: null,
    managedWorkUnits: null,
    seed: null,
    runId: null,
    silent: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--output":
      case "-o": {
        options.output = argv[++index] || null;
        break;
      }
      case "--json":
        options.json = true;
        break;
      case "--target":
        options.targetRatio = Number(argv[++index]);
        break;
      case "--baseline-iterations":
        options.baselineIterations = Number(argv[++index]);
        break;
      case "--managed-iterations":
        options.managedIterations = Number(argv[++index]);
        break;
      case "--baseline-work":
        options.baselineWorkUnits = Number(argv[++index]);
        break;
      case "--managed-work":
        options.managedWorkUnits = Number(argv[++index]);
        break;
      case "--seed":
        options.seed = Number(argv[++index]);
        break;
      case "--run-id":
        options.runId = argv[++index] || null;
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

function formatSummary(result) {
  const ratio = result.improvementRatio != null
    ? result.improvementRatio.toFixed(2)
    : "n/a";
  const baseline = result.baseline
    ? `${result.baseline.sendsPerSecond.toFixed(2)} sends/s`
    : "n/a";
  const managed = result.managed
    ? `${result.managed.sendsPerSecond.toFixed(2)} sends/s`
    : "n/a";
  return [
    "Managed JIT send benchmark",
    `  target ratio: ${result.targetRatio}`,
    `  improvement: ${ratio}x (${result.meetsTarget ? "meets" : "misses"} target)`,
    `  baseline:   ${baseline}`,
    `  managed:    ${managed}`
  ].join("\n");
}

function ensureDirectory(filePath) {
  if (!filePath) return;
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

export async function runManagedJITBenchmarkCommand(argv = process.argv.slice(2), io = process) {
  const options = parseArgs(argv);
  const benchmarkOptions = buildManagedJITBenchmarkOptions({
    baselineIterations: options.baselineIterations,
    managedIterations: options.managedIterations,
    baselineWorkUnits: options.baselineWorkUnits,
    managedWorkUnits: options.managedWorkUnits,
    targetRatio: options.targetRatio,
    seed: options.seed
  });

  const telemetryOptions = {
    runId: options.runId || `run-${Date.now()}`,
    source: "cli",
    consolePrefix: "[managed-jit]"
  };

  const result = await runManagedJITBenchmarkWithTelemetry(benchmarkOptions, telemetryOptions);

  if (options.output) {
    const outputPath = resolve(__dirname, "..", options.output);
    ensureDirectory(outputPath);
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    io.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (!options.silent) {
    io.stdout.write(`${formatSummary(result)}\n`);
  }

  return result;
}

if (process.argv[1] === __filename) {
  runManagedJITBenchmarkCommand().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
