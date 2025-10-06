import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  compareBenchmarks,
  comparePerformanceBenchmarksCommand
} from "../../tools/compare-performance-benchmarks.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..", "..", "..");

test("compareBenchmarks reports regressions above threshold", () => {
  const baseline = [
    {
      id: "arithmetic.integer",
      primaryMetric: "opsPerSecond",
      samples: [{ backend: "js", opsPerSecond: 1000, iterations: 1000 }]
    }
  ];
  const candidate = [
    {
      id: "arithmetic.integer",
      primaryMetric: "opsPerSecond",
      samples: [{ backend: "js", opsPerSecond: 800, iterations: 1000 }]
    }
  ];
  const regressions = compareBenchmarks(baseline, candidate, 0.1);
  assert.equal(regressions.length, 1);
  assert.equal(regressions[0].benchmarkId, "arithmetic.integer");
});

test("comparePerformanceBenchmarksCommand reads JSON fixtures", async () => {
  const baseDir = join(repoRoot, "tmp");
  mkdirSync(baseDir, { recursive: true });
  const workspace = mkdtempSync(join(baseDir, "perf-compare-"));
  try {
    const baselineFile = join(workspace, "baseline.json");
    const candidateFile = join(workspace, "candidate.json");
    writeFileSync(baselineFile, JSON.stringify({
      benchmarks: [
        {
          id: "execution.send.managed",
          primaryMetric: "sendsPerSecond",
          samples: [
            { backend: "baseline", sendsPerSecond: 1000, iterations: 1000 },
            { backend: "managed", sendsPerSecond: 2000, iterations: 1000 }
          ]
        }
      ]
    }));
    writeFileSync(candidateFile, JSON.stringify({
      benchmarks: [
        {
          id: "execution.send.managed",
          primaryMetric: "sendsPerSecond",
          samples: [
            { backend: "baseline", sendsPerSecond: 900, iterations: 1000 },
            { backend: "managed", sendsPerSecond: 2000, iterations: 1000 }
          ]
        }
      ]
    }));

    const previousExitCode = process.exitCode;
    try {
      const regressions = await comparePerformanceBenchmarksCommand([
        "--baseline",
        baselineFile,
        "--candidate",
        candidateFile,
        "--threshold",
        "0.05",
        "--silent"
      ]);
      assert.equal(regressions.length, 1);
      assert.equal(regressions[0].backend, "baseline");
    } finally {
      process.exitCode = previousExitCode ?? 0;
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
