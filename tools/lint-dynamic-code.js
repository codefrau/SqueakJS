import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "coverage",
  "benchmark",
  "demo",
  "etoys",
  "run",
  "tests",
  "SqueakV60.sources"
]);

const DEFAULT_ALLOWLIST = new Map([
  ["jit.js", { newFunction: true, functionConstructor: true }],
  ["vm.object.js", { newFunction: true, functionConstructor: true, eval: true }],
  ["vm.execution.jit.manager.js", { newFunction: true }],
  ["vm.resource.capabilities.js", { newFunction: true }],
  ["lib/sha1.js", { eval: true }],
  ["lib/jszip.js", { functionConstructor: true }]
]);

const PATTERNS = [
  { type: "newFunction", regex: /\bnew\s+Function\s*\(/g, key: "newFunction" },
  { type: "functionConstructor", regex: /(^|[^.\w$])Function\s*\(/g, key: "functionConstructor" },
  { type: "eval", regex: /(^|[^.\w$])eval\s*\(/g, key: "eval" }
];

function isIgnoredPath(relativePath, ignoredDirectories) {
  const segments = relativePath.split(/[\\/]+/);
  return segments.some((segment) => ignoredDirectories.has(segment));
}

export function analyzeDynamicCodeUsage(source) {
  if (typeof source !== "string") {
    return [];
  }
  const matches = [];
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(source)) !== null) {
      const index = match.index + (match[1] ? match[1].length : 0);
      if (pattern.type === "functionConstructor") {
        const preceding = source.slice(Math.max(0, index - 5), index).trimEnd();
        if (/new$/i.test(preceding)) {
          continue;
        }
      }
      matches.push({
        type: pattern.type,
        index
      });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

function scanFile(filePath, allowlistEntry) {
  const content = readFileSync(filePath, "utf8");
  const matches = analyzeDynamicCodeUsage(content);
  if (matches.length === 0) {
    return [];
  }
  const violations = [];
  for (const match of matches) {
    const isAllowed = allowlistEntry && allowlistEntry[match.type];
    if (!isAllowed) {
      const excerptStart = Math.max(0, match.index - 20);
      const excerptEnd = Math.min(content.length, match.index + 40);
      const excerpt = content.slice(excerptStart, excerptEnd).replace(/\s+/g, " ").trim();
      violations.push({
        type: match.type,
        excerpt
      });
    }
  }
  return violations;
}

function walk(directory, options, violations) {
  const entries = readdirSync(directory);
  for (const entry of entries) {
    const entryPath = resolve(directory, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      const relativePath = relative(options.root, entryPath);
      if (!isIgnoredPath(relativePath, options.ignoredDirectories)) {
        walk(entryPath, options, violations);
      }
      continue;
    }
    if (!entry.endsWith(".js") && !entry.endsWith(".mjs") && !entry.endsWith(".cjs")) {
      continue;
    }
    const relativePath = relative(options.root, entryPath);
    if (isIgnoredPath(relativePath, options.ignoredDirectories)) {
      continue;
    }
    const allowlistEntry = options.allowlist.get(relativePath) || options.allowlist.get(relativePath.replace(/\\/g, "/")) || options.allowlist.get(relativePath.replace(/\//g, "\\"));
    const fileViolations = scanFile(entryPath, allowlistEntry);
    if (fileViolations.length > 0) {
      violations.push({ file: relativePath, violations: fileViolations });
    }
  }
}

export function lintDynamicCode(options = {}) {
  const root = options.root ? resolve(options.root) : process.cwd();
  const ignoredDirectories = options.ignoredDirectories || DEFAULT_IGNORED_DIRECTORIES;
  const allowlist = options.allowlist || DEFAULT_ALLOWLIST;
  const violations = [];
  walk(root, { root, ignoredDirectories, allowlist }, violations);
  return { violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = lintDynamicCode({ root: process.cwd() });
  if (result.violations.length > 0) {
    console.error("Dynamic code lint violations detected:\n");
    for (const violation of result.violations) {
      console.error(`- ${violation.file}`);
      for (const detail of violation.violations) {
        console.error(`  * ${detail.type}: ${detail.excerpt}`);
      }
    }
    process.exit(1);
  }
}
