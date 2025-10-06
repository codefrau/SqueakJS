# High-Performance Browser VM Refactoring Plan

This plan converts the readiness assessment into a staged engineering program
that incrementally delivers the high-performance, hardened browser VM objective
for SqueakJS. Each track lists the concrete refactorings, success criteria, and
artifacts required for Codex execution.

## Program Structure

- **Cadence:** Bi-weekly increments, each producing a merge-ready PR and
  instrumented validation.
- **Workstreams:** Execution Engine, Runtime Hardening, Tooling & Telemetry,
  Testing & Benchmarks. Tracks can progress in parallel with coordination on
  shared interfaces.
- **Governance:** Maintain a working document of backend capabilities, publish
  performance dashboards from CI runs, and gate promotions on checklist
  completion per track.

## Track A — Execution Engine Modernization

### A1. Interpreter Detangling (Iteration 1)
- **Refactor `hackImage` usage** to consolidate image-specific patches behind
  feature detection APIs.
- **Define capability negotiation module** that expresses required image hooks
  and optional accelerators.
- **Success Criteria:** Interpreter boot without monkey patches for
  non-optional behavior; unit tests covering capability negotiation.

### A2. JavaScript Backend Optimization (Iteration 2)
- **Isolate bytecode dispatch loop** into a pure module allowing profiling and
  alternate implementations.
- **Introduce inline caching hooks** (stubbed) for method sends with metrics to
  measure cache hit rates.
- **Success Criteria:** Benchmark harness reports baseline dispatch metrics;
  feature-flagged cache layer deployable without affecting semantics.

### A3. Integrated JIT Replacement (Iterations 3-4)
- **Embed a minimal SSA-based JIT** (e.g., using existing `jit.js`) within the
  repo with policy controls for browser restrictions.
- **Implement safe fallback paths** when dynamic code generation is blocked,
  with telemetry to capture denial reasons.
- **Success Criteria:** JIT-enabled benchmarks show >2x improvement on method
  send microbenchmarks; fallbacks logged and test-covered.

### A4. WebAssembly Backend Expansion (Iterations 4-6)
- **Extend Wasm module** to include stack management, bytecode decoding, and a
  primitive dispatch table.
- **Share object heap through structured cloning** or SharedArrayBuffer with
  synchronization guards.
- **Success Criteria:** Prototype runs bytecode loops end-to-end in Wasm; CI
  benchmarks demonstrate parity or better versus JS backend on arithmetic and
  collection workloads.

## Track B — Runtime Hardening & Browser Integration

### B1. Memory Management Contracts (Iteration 1)
- **Formalize adaptive memory interfaces** with explicit VM-owned policies and
  image callbacks marked optional.
- **Add guardrails** that default to conservative GC when hooks are absent.
- **Success Criteria:** Memory system operates with zero optional hooks while
  maintaining stability under stress tests.

### B2. Resource Capability Matrix (Iteration 2)
- **Enumerate browser APIs** (audio, clipboard, fullscreen) and surface them via
  capability objects returned to the image.
- **Deprecate warning-only fallbacks** in favor of structured error channels and
  retry policies.
- **Success Criteria:** Worker host exposes typed capability map; automated
  tests simulate denied permissions without crashing the image.

### B3. Security & Determinism Review (Iteration 3)
- **Audit dynamic eval usage** and replace with policy-gated factories.
- **Document deterministic execution mode** disabling time-based heuristics and
  network access for reproducible runs.
- **Success Criteria:** Lint rule ensures no unauthorized `Function`
  construction; deterministic mode validated by repeatable benchmark outputs.

## Track C — Tooling, Telemetry, and Observability

### C1. Telemetry Pipeline Hardening (Iteration 1)
- **Standardize telemetry schema** with versioned payloads and bounded buffers.
- **Expose metrics exporters** (console, postMessage, WebWorker trace) with
  throttling.
- **Success Criteria:** Telemetry consumers validated by contract tests; no
  unbounded growth observed in soak tests.

### C2. Performance Dashboards (Iteration 2)
- **Integrate benchmark suite** into CI (e.g., Playwright + Web Worker) with
  artifacts stored for trend analysis.
- **Automate regression gates** that compare against baseline medians.
- **Success Criteria:** CI fails on >10% performance regressions; dashboard
  renders accessible trend data.

### C3. Developer Tooling Enhancements (Iteration 3)
- **Add profiling hooks** for message sends, GC events, and backend switches.
- **Provide CLI tooling** to replay telemetry logs and generate flamegraphs.
- **Success Criteria:** Tooling documented, exercised in developer guide, and
  covered by smoke tests.

## Track D — Testing & Quality Assurance

### D1. Test Infrastructure Foundation (Iteration 1)
- **Set up unit test harness** (Vitest/Jest) for isolated modules (interpreter
  components, memory policies).
- **Adopt structured test data** for image capability stubs and wasm fixtures.
- **Success Criteria:** Minimum coverage target (e.g., 60%) for core modules;
  CI enforcing lint + test suites.

### D2. Integration & Stress Suites (Iteration 2)
- **Develop worker/browser integration tests** simulating throttled threads,
  permission denials, and network delays.
- **Create long-running stress harness** for memory and event queues using
  headless browser automation.
- **Success Criteria:** Stress suite runs nightly; defects reproduce via
  deterministic scripts.

### D3. Performance Regression Tests (Iteration 3)
- **Implement benchmark catalog** covering arithmetic kernels, message sends,
  graphics blits, and IO primitives.
- **Automate comparison** across JS and Wasm backends with statistical
  significance tracking.
- **Success Criteria:** Benchmarks produce machine-readable outputs ingested by
  dashboards; alerts trigger on regression.

## Cross-Cutting Deliverables

- **Architecture Decision Records (ADRs):** Capture major design choices per
  track for future maintainability.
- **Documentation Refresh:** Update developer guide and browser deployment docs
  after each iteration.
- **Rollout Playbook:** Define how to graduate features from experimental to
  default, including kill switches and rollback instructions.

## Initial Iteration Backlog (Iteration 1)

- [x] Refactor interpreter capability negotiation (A1).
- [x] Harden adaptive memory defaults (B1).
- [x] Standardize telemetry schema (C1).
- [x] Establish unit test harness with baseline coverage (D1).

Each item includes design notes, implementation tasks, validation steps, and
documentation updates. Iteration concludes with consolidated CI evidence and an
executive summary of readiness progress.

## Iteration 2 Backlog (In Progress)

- [x] Isolate the bytecode dispatch loop into a pure module with instrumentation hooks (A2).
- [x] Introduce inline cache hooks with hit/miss telemetry scaffolding (A2).
- [x] Enumerate browser resource capabilities and expose typed capability maps (B2).
- [x] Automate performance telemetry dashboards with regression alerting (C2).
- [x] Build worker/browser integration and stress suites covering throttled and denied flows (D2). _Integration harness extended with telemetry-backed stress scenarios covering throttled timers, denied permissions, and local detection failures, with dependency-injected telemetry handlers for host-specific context/tag wiring and abort-aware feature report requests so hosts can cancel pending probes without leaking timers or telemetry hooks._
- [x] Harden JavaScript backend instrumentation and inline cache telemetry (A2). _Dispatcher hooks now surface quick-send fallbacks, primitive invocations, and handler failures to the inline cache monitor, which records evictions even when telemetry emission is suppressed so benchmarking harnesses capture consistent lookup metrics._

## Iteration 3 Backlog (Planned)

The third iteration focuses on eliminating the highest-risk gaps highlighted in the
readiness assessment that remain unaddressed after Iteration 2. Each backlog item
translates the Track roadmap into concrete, Codex-executable tasks with explicit
deliverables and validation requirements.

- [x] **Embed managed JIT replacement with defensive fallbacks (A3).** _Managed JIT controller now injects policy-aware enablement into the interpreter, consumes browser capability matrices to preempt CSP-denied dynamic code, and records telemetry-backed fallback reasons. The managed send-loop runner feeds `tools/run-managed-jit-benchmark.js`, which emits automated telemetry evidence demonstrating the >2× send target through the benchmark catalog so promotion gates can consume repeatable measurements._
  - _Scope:_ Vendor a self-hosted SSA JIT from `jit.js`, encapsulate policy flags in
    `vm.execution.js`, and expose denial telemetry when dynamic code generation is
    blocked by the host.
  - _Deliverables:_
    - New `vm.execution.jit.manager.js` module with build- and runtime-configurable guards.
    - Interpreter wiring that promotes the managed JIT when the capability matrix
      reports unrestricted `Function` construction.
    - Telemetry events routed through `vm.telemetry.channel.js` enumerating enablement
      and fallback reasons.
    - Benchmark harness API under `vm.execution.jit.benchmark.js` that measures send
      throughput with and without managed JIT for CI automation, plus CLI wiring in
      `tools/run-managed-jit-benchmark.js` for on-demand telemetry snapshots.
  - _Validation:_
    - Unit tests faking host policies to assert promotion, fallback, and logging flows.
    - Benchmark harness update capturing >2× improvements on send microbenchmarks with
      the managed JIT enabled, with CLI-driven telemetry artifacts recorded under
      `dist/telemetry/`.

- [x] **Formalize security and deterministic execution policies (B3).** _Deterministic execution is now opt-in through interpreter options that rewire clocks, randomness, and network access, with capability negotiation surfacing clock step and denial telemetry while lint automation enforces the dynamic-code policy._
  - _Scope:_ Audit dynamic evaluation, introduce factories gated by capability policy,
    and document deterministic runtime mode toggles to satisfy industrial hardening
    requirements.
  - _Deliverables:_
    - Lint or static analysis rule codified in `tools/` that fails builds on
      unauthorized `Function` usage.
    - Deterministic mode configuration surfaced via `vm.capabilities.js` and
      interpreter options, disabling time-based heuristics and network-dependent
      fallbacks.
    - Developer documentation describing deterministic mode activation and limits. _See `docs/deterministic_mode.md` for the current developer guide._
  - _Validation:_
    - Automated lint test demonstrating enforcement.
    - Deterministic smoke test recording repeatable benchmark output snapshots.

- [x] **Developer tooling enhancements for profiling and telemetry replay (C3).** _Execution profiler now emits structured send, primitive, GC, and backend events via `vm.execution.profiling.js`, with replay tooling (`tools/replay-execution-profile.js` and `npm run perf:profile`) producing summaries and flamegraph inputs documented in `docs/execution_profiling.md`._
  - _Scope:_ Provide developer-focused instrumentation hooks that complement the
    dashboards shipped in Iteration 2 and close the tooling deficit cited in the
    assessment.
  - _Deliverables:_
    - Profiling API emitting structured events for message sends, GC cycles, and
      backend switches.
    - CLI utilities under `tools/` to replay telemetry logs and generate flamegraphs or
      summary tables.
    - Documentation updates in `docs/` describing usage patterns and integration with
      existing dashboards.
  - _Validation:_
    - Unit tests covering event emission and CLI argument handling.
    - Example telemetry replay script exercised in CI to guarantee non-regression.

- [x] **Performance regression test harness (D3).** _Benchmark catalog now exercises managed JIT sends, arithmetic kernels, graphics blits, and buffer IO primitives, producing machine-readable results in `dist/telemetry/benchmarks.json` with comparison tooling that fails builds on >10% regressions._
  - _Scope:_ Create statistically aware benchmarks spanning arithmetic, message sends,
    graphics blits, and IO primitives, comparing JavaScript, managed JIT, and WebAssembly
    backends where available.
  - _Deliverables:_
    - Benchmark catalog under `benchmark/` with machine-readable output consumed by
      dashboards.
    - Automated comparison script that flags >10% regressions with significance gating.
    - CI wiring integrating the new harness alongside existing coverage and integration
      suites.
  - _Validation:_
    - CI artifacts demonstrating benchmark execution across backends.
    - Unit tests for the comparison logic to ensure gating rules fire as expected.

- [x] **Complete stress instrumentation for worker/browser integration (D2 follow-up).**
  - _Scope:_ Finish the outstanding work from Iteration 2 by adding long-running stress
    scenarios that exercise worker queues, capability churn, and throttled timers.
  - _Deliverables:_
    - Stress scripts under `tests/stress/` targeting worker I/O and memory churn.
    - Dashboard integration capturing stress metrics alongside telemetry summaries.
  - _Validation:_
    - CI (or scheduled) execution evidence plus documented recovery heuristics when
      throttling is detected.

