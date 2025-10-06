import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runManagedJITBenchmarkCommand } from "../../tools/run-managed-jit-benchmark.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..", "..", "..");

test("runManagedJITBenchmarkCommand emits JSON when requested", async () => {
  const messages = [];
  const io = { stdout: { write: (chunk) => messages.push(chunk) } };
  const result = await runManagedJITBenchmarkCommand(["--json", "--run-id", "test-run", "--target", "1"], io);
  assert.ok(Number.isFinite(result.improvementRatio));
  assert.ok(messages.length > 0);
  const parsed = JSON.parse(messages.join("").trim());
  assert.equal(parsed.meetsTarget, result.meetsTarget);
});

test("runManagedJITBenchmarkCommand writes output file", async () => {
  const workspace = mkdtempSync(join(repoRoot, "tmp-jit-benchmark-"));
  try {
    const outputFile = join(workspace, "managed.json");
    const io = { stdout: { write: () => {} } };
    const result = await runManagedJITBenchmarkCommand(["--output", outputFile, "--silent"], io);
    assert.ok(result.baseline);
    const stored = JSON.parse(readFileSync(outputFile, "utf8"));
    assert.equal(stored.meetsTarget, result.meetsTarget);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
