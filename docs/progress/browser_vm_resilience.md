# Browser VM Resilience Progress

This log tracks implementation milestones from `docs/browser_vm_resilience_plan.md`. Each entry captures status,
last update metadata, and validation evidence.

## 1. Worker-Based Execution

### Milestone 1: Baseline profiling
- Status: ✅ Completed
- Last Updated: 2025-10-05
- Commit: pending (current PR)
- Notes: Instrumented the main-thread interpreter loop with telemetry that records execution duration and inter-frame
  latency. Added an on-screen stats panel and periodic console summaries to verify measurements while images run.

### Milestone 2: Worker bootstrap prototype
- Status: ✅ Completed
- Last Updated: 2025-10-06
- Commit: pending (current PR)
- Notes: Added a worker entry module that loads the full VM inside a Web Worker using stubbed display/input bridges, along with a host-side controller API. The worker now signals banner/progress updates and reports when the first display rect is produced, confirming Morphic boots even without a visible canvas.

### Milestone 3: OffscreenCanvas integration
- Status: ✅ Completed
- Last Updated: 2025-10-07
- Commit: pending (current PR)
- Notes: Worker display now acquires an OffscreenCanvas, renders Morphic updates with the full browser display pipeline, and reports geometry back to the host so CSS scaling matches pixel resolution. Canvas-backed runs display frames directly from the worker without blocking the UI thread.

### Milestone 4: Input/event channel hardening
- Status: ✅ Completed
- Last Updated: 2025-10-08
- Commit: pending (current PR)
- Notes: Added structured-clone bridges that stream keyboard, mouse, and clipboard events from the host thread to the worker
  display, plus clipboard request/response helpers. Introduced unit coverage for multi-event batching and clipboard proxying to
  ensure DOM-less harnesses can verify the channel.

### Milestone 5: Feature parity validation
- Status: ✅ Completed
- Last Updated: 2025-10-09
- Commit: pending (current PR)
- Notes: Added a worker feature report channel that inventories display, audio, and file primitives, wired the host controller
  to request and cache reports, and created automated parity tests comparing worker coverage against the browser display/file
  plugins. Documented remaining main-thread dependencies (fullscreen, clipboard, AudioContext resume) in the generated report.

## 2. WebAssembly Execution Path

### Milestone 1: Feasibility spike
- Status: ✅ Completed
- Last Updated: 2025-10-10
- Commit: pending (current PR)
- Notes: Added a standalone WebAssembly prototype for the interpreter's inner loop with a build script that emits binary, wat,
  and metadata artifacts. Benchmarked the WASM loop versus the existing JS helper via `tests/wasm/feasibility.test.mjs`, verifying
  matching outputs and capturing timing samples for baseline comparison.

### Milestone 2: Hybrid execution layer
- Status: ✅ Completed
- Last Updated: 2025-10-11
- Commit: pending (current PR)
- Notes: Added a pluggable execution backend registry with default JS and prototype WASM backends, wired the interpreter to
  delegate slices through the selected backend, and enabled query/hash parameters to request the wasm-prototype driver. Added a
  unit test to verify backend selection, reconfiguration, and fallback warnings.

### Milestone 3: State interop
- Status: ✅ Completed
- Last Updated: 2025-10-12
- Commit: pending (current PR)
- Notes: Added a shared heap bridge that mirrors object memory into a SharedArrayBuffer when available with automatic
  fallbacks for CSP-restricted contexts. The wasm backend now synchronizes through the shared heap before executing and
  exposes heap metadata for parity checks. New unit coverage verifies backend swaps maintain heap integrity.

### Milestone 4: JIT parity
- Status: ✅ Completed
- Last Updated: 2025-10-13
- Commit: pending (current PR)
- Notes: Added wasm-accelerated integer primitive helpers with synchronous shared-heap access, wired the wasm backend to
  install/remove accelerators, and covered arithmetic/comparison correctness plus performance benchmarks that exceed the
  4× speedup target on the batch harness.

### Milestone 5: Distribution packaging
- Status: ✅ Completed
- Last Updated: 2025-10-14
- Commit: pending (current PR)
- Notes: Build pipeline now emits the wasm prototype bundle into `dist/wasm/` during `npm run build`, the loader streams and caches
  the artifact when browsers support it, and README guidance covers MIME type plus CSP requirements for hosting the new assets.

## 3. Configurable Memory Management

### Milestone 1: Config surface
- Status: ✅ Completed
- Last Updated: 2025-10-15
- Commit: pending (current PR)
- Notes: Added a memory configuration surface that parses query-string or API-provided options for headroom, young-space ratios, and low-space thresholds. The VM now tracks allocation bytes, auto-triggers partial GCs when limits are exceeded, updates README guidance, and synchronizes interpreter low-space warnings with the configured thresholds.

### Milestone 2: Runtime telemetry
- Status: ✅ Completed
- Last Updated: 2025-10-16
- Commit: pending (current PR)
- Notes: Added a shared telemetry module that installs periodic memory sampling on both
  main-thread and worker interpreters, emits warning logs as configurable thresholds are
  crossed, and exposes snapshot/history arrays through `vmParameterAt:` for Smalltalk tooling.
  README now documents the option surface and array layout.

### Milestone 3: Adaptive strategy
- Status: ✅ Completed
- Last Updated: 2025-10-17
- Commit: pending (current PR)
- Notes: Introduced an adaptive memory manager that evaluates host heap pressure and VM free space, expanding headroom in configurable steps when allocations approach the limit and shrinking budgets once the browser nears its quota. Added automated coverage that simulates low-memory conditions, enforces host caps, and verifies partial GCs are triggered before contraction when required.

### Milestone 4: Chunked image loading
- Status: ✅ Completed
- Last Updated: 2025-10-18
- Commit: pending (current PR)
- Notes: Added a streaming image loader that consumes async chunk sources, wired the browser pipeline to prefer fetch-based image
  streams with caching fallbacks, and validated that streamed loads match traditional buffer loads via the new chunk-loading test
  harness.

## 4. Expanded Image Compatibility
- All milestones: ☐ Not started

## 5. Clipboard Reliability
- All milestones: ☐ Not started

## 6. Persistent Storage Resilience
- All milestones: ☐ Not started

## 7. Media Access Fallbacks
- All milestones: ☐ Not started

## 8. Progressive Image Loading
- All milestones: ☐ Not started

