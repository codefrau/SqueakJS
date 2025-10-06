#!/usr/bin/env node
"use strict";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compareTelemetrySummaries, summarizeTelemetry } from "../vm.telemetry.dashboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..", "");

function parseArgs(argv) {
  const args = { failOnRegression: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output" || arg === "-o") {
      args.output = argv[++i];
    } else if (arg === "--namespaces" || arg === "-n") {
      const value = argv[++i];
      args.namespaces = value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
    } else if (arg === "--baseline" || arg === "-b") {
      args.baseline = argv[++i];
    } else if (arg === "--threshold" || arg === "-t") {
      const value = Number.parseFloat(argv[++i]);
      if (Number.isFinite(value) && value >= 0) {
        args.threshold = value;
      }
    } else if (arg === "--no-fail-on-regression") {
      args.failOnRegression = false;
    } else if (arg === "--metric-policy") {
      const entry = argv[++i];
      if (entry) {
        const [name, policy] = entry.split(":");
        if (name && policy) {
          args.metricPolicies = args.metricPolicies || {};
          args.metricPolicies[name] = { higherIsBetter: policy.trim() === "higher" };
        }
      }
    }
  }
  return args;
}

function readBaseline(filePath) {
  if (!filePath) return null;
  try {
    const resolved = resolve(projectRoot, filePath);
    const content = readFileSync(resolved, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn(`[telemetry] failed to read baseline ${filePath}:`, error.message || error);
    }
    return null;
  }
}

function ensureDirectory(filePath) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = summarizeTelemetry(args.namespaces);
  const baseline = readBaseline(args.baseline);
  const comparison = compareTelemetrySummaries(summary, baseline, {
    threshold: args.threshold,
    metricPolicies: args.metricPolicies
  });

  const payload = {
    generatedAt: summary.generatedAt,
    namespaces: summary.namespaces,
    baselinePath: args.baseline || null,
    regressions: comparison.regressions
  };

  if (args.output) {
    const outputPath = resolve(projectRoot, args.output);
    ensureDirectory(outputPath);
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`[telemetry] wrote report to ${outputPath}`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }

  if (args.failOnRegression && comparison.regressions.some((item) => item.regressed)) {
    console.error("[telemetry] regression detected above configured threshold");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[telemetry] unexpected error", error);
  process.exitCode = 1;
});
