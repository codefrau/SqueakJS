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
- [ ] Build worker/browser integration and stress suites covering throttled and denied flows (D2). _Integration harness landed; long-running stress instrumentation pending._

