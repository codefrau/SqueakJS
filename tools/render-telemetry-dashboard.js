#!/usr/bin/env node
"use strict";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compareTelemetrySummaries, summarizeTelemetry } from "../vm.telemetry.dashboard.js";
import { renderMarkdownDashboard, renderTextDashboard } from "../vm.telemetry.dashboard.render.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..", "");

function parseArgs(argv) {
  const args = {
    format: "markdown",
    failOnRegression: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output" || arg === "-o") {
      args.output = argv[++i];
    } else if (arg === "--format" || arg === "-f") {
      const value = (argv[++i] || "").toLowerCase();
      if (value === "text" || value === "markdown") {
        args.format = value;
      }
    } else if (arg === "--title") {
      args.title = argv[++i];
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
    } else if (arg === "--metric-policy") {
      const entry = argv[++i];
      if (entry) {
        const [name, policy] = entry.split(":");
        if (name && policy) {
          args.metricPolicies = args.metricPolicies || {};
          args.metricPolicies[name] = { higherIsBetter: policy.trim() === "higher" };
        }
      }
    } else if (arg === "--input" || arg === "-i") {
      args.input = argv[++i];
    } else if (arg === "--fail-on-regression") {
      args.failOnRegression = true;
    } else if (arg === "--no-fail-on-regression") {
      args.failOnRegression = false;
    }
  }

  return args;
}

function readJSON(filePath) {
  if (!filePath) return null;
  try {
    const resolved = resolve(projectRoot, filePath);
    const content = readFileSync(resolved, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn(`[telemetry] failed to read ${filePath}:`, error.message || error);
    }
    return null;
  }
}

function readBaseline(filePath) {
  return readJSON(filePath);
}

function filterNamespaces(summary, namespaces) {
  if (!Array.isArray(namespaces) || namespaces.length === 0) return summary;
  if (!summary || !Array.isArray(summary.namespaces)) return summary;
  const namespaceSet = new Set(namespaces);
  return {
    generatedAt: summary.generatedAt,
    namespaces: summary.namespaces.filter((entry) => entry && namespaceSet.has(entry.namespace))
  };
}

function filterRegressions(comparison, namespaces) {
  if (!Array.isArray(namespaces) || namespaces.length === 0) return comparison;
  if (!comparison || !Array.isArray(comparison.regressions)) return comparison;
  const namespaceSet = new Set(namespaces);
  return {
    regressions: comparison.regressions.filter((entry) => entry && namespaceSet.has(entry.namespace))
  };
}

function ensureDirectory(filePath) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
}

function generateFromTelemetry(args) {
  const summary = summarizeTelemetry(args.namespaces);
  const baseline = readBaseline(args.baseline);
  const comparison = compareTelemetrySummaries(summary, baseline, {
    threshold: args.threshold,
    metricPolicies: args.metricPolicies
  });
  return { summary, comparison };
}

function generateFromInput(args) {
  const payload = readJSON(args.input);
  if (!payload) {
    return { summary: { generatedAt: Date.now(), namespaces: [] }, comparison: { regressions: [] } };
  }
  let summary = { generatedAt: payload.generatedAt ?? Date.now(), namespaces: payload.namespaces || [] };
  let comparison = { regressions: Array.isArray(payload.regressions) ? payload.regressions : [] };
  if (args.namespaces && args.namespaces.length) {
    summary = filterNamespaces(summary, args.namespaces);
    comparison = filterRegressions(comparison, args.namespaces);
  }
  return { summary, comparison };
}

function renderDashboard(args, summary, comparison) {
  const options = { summary, comparison, title: args.title };
  if (args.format === "text") {
    return renderTextDashboard(options);
  }
  return renderMarkdownDashboard(options);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { summary, comparison } = args.input
    ? generateFromInput(args)
    : generateFromTelemetry(args);
  const output = renderDashboard(args, summary, comparison);

  if (args.output) {
    const outputPath = resolve(projectRoot, args.output);
    ensureDirectory(outputPath);
    writeFileSync(outputPath, `${output}\n`, "utf8");
    console.log(`[telemetry] wrote dashboard to ${outputPath}`);
  } else {
    console.log(output);
  }

  if (args.failOnRegression && comparison.regressions.some((item) => item && item.regressed)) {
    console.error("[telemetry] regression detected above configured threshold");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[telemetry] unexpected error", error);
  process.exitCode = 1;
});
