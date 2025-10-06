# Execution Profiling Toolkit

The execution profiler instruments the JavaScript backend to capture message sends,
primitive dispatches, garbage collection cycles, and backend transitions without
requiring consumers to wire telemetry manually. This document describes how to
activate the profiler, interpret its events, and replay captured sessions.

## Enabling the Profiler

The interpreter automatically installs a profiler instance when `managedJIT` or
other execution options are initialized. You can configure profiling through the
`options.profiling` field passed to `Squeak.Interpreter`:

```js
const vm = new Squeak.Interpreter(image, display, {
  profiling: {
    bufferLimit: 5000,
    metadata: { runId: "local-benchmark" }
  }
});
```

Set `options.profiling` to `false` to disable instrumentation. When enabled, the
profiler exposes a `createDispatchHooks()` helper that is consumed by the bytecode
dispatcher, so send and primitive operations are recorded automatically.

## Event Types

Each profiling entry is a structured object with a `type`, `timestamp`, and
`payload`. The following event types are emitted:

- `send`: Message sends and special selectors. Payload fields include
  `selector`, `selectorHash`, `selectorId`, `argCount`, `super`, `opcode`, and
  `special` for quick-send fallbacks.
- `primitive`: Primitive bytecode dispatches. The payload reports the primitive
  `index` and originating `opcode` when available.
- `gc`: Garbage collection cycles. The payload includes `kind` (`full` or
  `partial`), `reason`, `durationMs`, and collected statistics such as
  `previousNew`, `survivingNew`, and `gcedOld` when available.
- `backend`: Execution backend transitions triggered through
  `configureExecutionBackendForVM`. Payload fields include `previous`, `next`,
  and `requested` backend identifiers.

Consumers can access buffered events through `profiler.getEvents()` or reset the
buffer with `profiler.flush()`. The `profiler.summarize()` helper returns quick
counts per event type.

## Telemetry Integration

Profiling can emit directly into the shared telemetry pipeline by providing a
`telemetry` configuration:

```js
const profiler = createExecutionProfiler({
  telemetry: {
    namespace: "execution.profile",
    version: 1,
    tags: { node: "worker-1" }
  }
});
```

Telemetry emission falls back silently if the channel is unavailable, ensuring
profiling never interferes with runtime operation.

## Replaying Profiles

Use the replay CLI to summarize recorded sessions or generate input for
flamegraph tooling:

```bash
npm run perf:profile -- --input artifacts/profile.json --flame artifacts/profile.collapsed
```

The command prints aggregate counts per event type, highlights the most frequent
selectors and primitives, and writes a collapsed stack file suitable for tools
such as `FlameGraph.pl`. Provide the `--quiet` flag to suppress console output or
`--output` to emit the textual summary to disk.

The parser accepts raw event arrays or wrapped payloads from telemetry exports,
allowing direct reuse of profiler buffers or channel captures.
