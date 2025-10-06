import test from "node:test";
import assert from "node:assert/strict";

import {
  runPerformanceBenchmarksCommand,
  listBenchmarkIdentifiers
} from "../../tools/run-performance-benchmarks.js";

test("listBenchmarkIdentifiers exposes catalog entries", () => {
  const identifiers = listBenchmarkIdentifiers();
  assert.ok(Array.isArray(identifiers));
  assert.ok(identifiers.includes("execution.send.managed"));
  assert.ok(identifiers.includes("arithmetic.integer"));
});

test("runPerformanceBenchmarksCommand emits JSON when requested", async () => {
  const messages = [];
  const io = { stdout: { write: (chunk) => messages.push(chunk) } };
  const result = await runPerformanceBenchmarksCommand(["--json"], io);
  assert.ok(Array.isArray(result.benchmarks));
  const parsed = JSON.parse(messages.join("").trim());
  assert.equal(parsed.generatedAt, result.generatedAt);
  assert.equal(parsed.benchmarks.length, result.benchmarks.length);
});
