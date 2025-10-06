# Performance Benchmark Catalog

The performance regression harness provides a repeatable way to exercise the
high-risk execution paths highlighted in the readiness assessment. The catalog
runs on Node.js and produces machine-readable output that can be compared across
builds to gate promotions.

## Running the catalog

Use the npm script to execute the catalog and write the latest results to
`dist/telemetry/benchmarks.json`:

```sh
npm run perf:benchmarks
```

The script invokes `tools/run-performance-benchmarks.js`, which emits a summary
to stdout and stores the full JSON artifact. Each benchmark entry records the
unit, samples per backend, and the primary metric used for regression detection.

### Managed JIT send benchmark

The managed JIT benchmark uses the synthetic send-loop runner from
`benchmark/send-loop-runner.js` to measure baseline and managed throughput while
capturing inline cache metrics. `tools/run-managed-jit-benchmark.js` can be
invoked directly to capture telemetry evidence for dedicated runs:

```sh
npm run perf:jit -- --json --output dist/telemetry/managed-jit.json
```

Both the catalog and the dedicated JIT command emit telemetry events under the
`execution.jit.benchmark` namespace so dashboards and automated gating have
consistent data.

## Comparing results

The comparison utility `tools/compare-performance-benchmarks.js` consumes two
JSON artifacts and flags any regressions beyond a configurable threshold. For
example, to compare a baseline artifact against the latest run:

```sh
node tools/compare-performance-benchmarks.js \
  --baseline dist/telemetry/benchmarks-baseline.json \
  --candidate dist/telemetry/benchmarks.json \
  --threshold 0.1
```

The command exits with a non-zero status when regressions are detected. The
comparison step is also wired into `tools/run-tests-with-coverage.js`, which
executes the benchmark catalog automatically (unless `RUN_PERF_BENCHMARKS=0` is
set) so CI runs publish up-to-date telemetry artifacts.
