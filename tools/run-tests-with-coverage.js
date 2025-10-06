import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const coverageDir = resolve(projectRoot, "coverage");

function prepareCoverageDirectory() {
  if (existsSync(coverageDir)) {
    rmSync(coverageDir, { recursive: true, force: true });
  }
  mkdirSync(coverageDir, { recursive: true });
}

function collectCoverageArtifacts() {
  const coverageFiles = readdirSync(coverageDir).filter((file) => file.endsWith(".json"));
  if (coverageFiles.length === 0) {
    return;
  }
  const payload = { result: [] };
  for (const file of coverageFiles) {
    const filePath = resolve(coverageDir, file);
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    if (Array.isArray(data.result)) {
      payload.result.push(...data.result);
    }
  }
  writeFileSync(resolve(coverageDir, "v8-coverage.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function extractCoverageSummary(stdoutBuffer) {
  const stdout = stdoutBuffer.join("");
  const tableMatch = stdout.match(/start of coverage report([\s\S]*?)end of coverage report/);
  if (tableMatch) {
    const table = tableMatch[0].trim();
    writeFileSync(resolve(coverageDir, "summary.txt"), `${table}\n`, "utf8");
  }

  const summaryMatch = stdout.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/);
  if (!summaryMatch) {
    console.error("\nCoverage summary not found in test output.\n");
    process.exitCode = 1;
    return null;
  }

  return {
    lines: Number.parseFloat(summaryMatch[1]),
    branches: Number.parseFloat(summaryMatch[2]),
    functions: Number.parseFloat(summaryMatch[3])
  };
}

async function run() {
  prepareCoverageDirectory();

  const stdoutBuffer = [];

  const suitePaths = ["tests/unit", "tests/integration"]
    .map((suite) => resolve(projectRoot, suite))
    .filter((suitePath) => existsSync(suitePath));

  if (suitePaths.length === 0) {
    console.error("No test suites found. Expected tests/unit or tests/integration to exist.");
    process.exitCode = 1;
    return;
  }

  const relativeSuites = suitePaths.map((suitePath) => suitePath.replace(`${projectRoot}/`, ""));

  const child = spawn(process.execPath, ["--test", "--experimental-test-coverage", ...relativeSuites], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_V8_COVERAGE: coverageDir
    }
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    stdoutBuffer.push(chunk);
    process.stdout.write(chunk);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  const exitCode = await new Promise((resolvePromise) => {
    child.on("close", (code, signal) => {
      if (signal) {
        resolvePromise(128 + signal);
      } else {
        resolvePromise(code ?? 0);
      }
    });
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }

  const summary = extractCoverageSummary(stdoutBuffer);
  collectCoverageArtifacts();

  if (!summary) {
    process.exitCode = 1;
    return;
  }

  const thresholds = {
    lines: 60,
    branches: 30,
    functions: 60
  };

  const failures = Object.entries(thresholds)
    .filter(([metric, minimum]) => summary[metric] < minimum)
    .map(([metric, minimum]) => `${metric} ${summary[metric].toFixed(2)}% < ${minimum}%`);

  if (failures.length > 0) {
    console.error("\nCoverage thresholds not met:\n - " + failures.join("\n - "));
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
