import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeDynamicCodeUsage, lintDynamicCode } from "../../tools/lint-dynamic-code.js";

test("analyzeDynamicCodeUsage identifies dynamic code constructs", () => {
  const source = `
    const a = new Function('return 1');
    const b = Function('x', 'return x + 1');
    const value = eval('2 + 2');
  `;
  const matches = analyzeDynamicCodeUsage(source);
  assert.deepEqual(matches.map((match) => match.type), ["newFunction", "functionConstructor", "eval"]);
});

test("lintDynamicCode flags unauthorized dynamic code", () => {
  const workspace = mkdtempSync(join(tmpdir(), "lint-dynamic-code-"));
  try {
    const file = join(workspace, "example.js");
    writeFileSync(file, "const dynamic = new Function('return 42');", "utf8");
    const result = lintDynamicCode({
      root: workspace,
      ignoredDirectories: new Set(),
      allowlist: new Map()
    });
    assert.equal(result.violations.length, 1);
    assert.ok(result.violations[0].file.endsWith("example.js"));
    assert.equal(result.violations[0].violations[0].type, "newFunction");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
