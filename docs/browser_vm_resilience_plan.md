# Browser VM Resilience Implementation Plan

This roadmap translates the high-level gap analysis for the browser-hosted Squeak VM into a sequence of incremental, verifiable steps. Each workstream is broken into milestones with explicit acceptance criteria so progress can be tracked across multiple Codex iterations.

## 1. Worker-Based Execution

### Goal
Move interpreter and JIT work off the main UI thread to improve responsiveness while preserving feature parity.

### Milestones
1. **Baseline profiling**
   - Instrument the current main-thread loop to capture frame latency under scripted workloads.
   - Verify new telemetry is emitted to the console and exposed through a lightweight stats panel.
2. **Worker bootstrap prototype**
   - Load the VM inside a Web Worker with message-based bridges for display/input stubs.
   - Demonstrate image boot to the first Morphic frame with display no-ops.
3. **OffscreenCanvas integration**
   - Replace display stubs with `OffscreenCanvas` to render Morphic output from the worker.
   - Acceptance: render loop sustains 30 FPS on the Etoys demo image.
4. **Input/event channel hardening**
   - Forward keyboard, mouse, clipboard, and semaphore signaling through structured clones.
   - Add integration tests covering typing, mouse drag, and clipboard copy/paste.
5. **Feature parity validation**
   - Run regression suite (display, sound, file) comparing worker vs. main thread outputs.
   - Document remaining platform APIs that must stay on the main thread with fallback mechanisms.

## 2. WebAssembly Execution Path

### Goal
Provide a high-performance fallback when dynamic JS compilation is restricted or slow.

### Milestones
1. **Feasibility spike**
   - Compile the interpreter core to WebAssembly via Emscripten or AssemblyScript.
   - Benchmark tight loops against the JS interpreter to establish baseline wins.
2. **Hybrid execution layer**
   - Introduce a pluggable execution interface where either JS or Wasm backends implement the same hooks.
   - Acceptance: switching backends via query parameter without code rebuilds.
3. **State interop**
   - Share object memory between JS and Wasm using `SharedArrayBuffer` (with CSP fallback).
   - Add unit tests that swap backends mid-execution without corrupting the image.
4. **JIT parity**
   - Implement primitive/JIT hotspots (e.g., arithmetic, message send) in Wasm and compare throughput.
   - Success metric: ≥1.5× speedup on the DeltaBlue benchmark relative to interpreter-only mode.
5. **Distribution packaging**
   - Extend build pipeline to emit Wasm artifacts, update loader to feature-detect and cache them.
   - Document configuration and CSP requirements in README.

## 3. Configurable Memory Management

### Goal
Allow large images to run reliably by making memory ceilings adjustable and monitored.

### Milestones
1. **Config surface**
   - Expose heap headroom, old/new space ratios, and GC thresholds as load options.
   - Acceptance: options documented and adjustable via query string.
2. **Runtime telemetry**
   - Collect periodic memory usage snapshots and surface warnings when thresholds near limits.
   - Provide a Smalltalk primitive to query host memory stats.
3. **Adaptive strategy**
   - Implement heuristics that expand/shrink allocation buffers within browser quotas.
   - Simulate low-memory conditions and verify graceful degradation (no hard crashes).
4. **Chunked image loading**
   - Stream image segments and install objects incrementally.
   - Measure startup time improvements on ≥100 MB images.

## 4. Expanded Image Compatibility

### Goal
Support 64-bit non-Spur images or provide automated conversion.

### Milestones
1. **Format detection audit**
   - Catalogue unsupported image headers and add explicit logging with guidance.
2. **Conversion toolchain**
   - Create a CLI (Node-based) that converts non-Spur 64-bit images to Spur.
   - Include regression fixtures to verify object/selector counts post-conversion.
3. **Native loader path**
   - Implement parsing and object reconstruction for at least one non-Spur 64-bit variant.
   - Acceptance: boot legacy test image to Smalltalk prompt in-browser.
4. **Documentation & migration guide**
   - Update docs with supported matrices, conversion instructions, and troubleshooting.

## 5. Clipboard Reliability

### Goal
Ensure clipboard operations function consistently even when user-gesture requirements are strict.

### Milestones
1. **Async Clipboard API integration**
   - Adopt `navigator.clipboard` with permission handling and fallback messaging.
   - Add feature detection tests covering denied permissions.
2. **Background request queue**
   - Use VM `freeze` continuations to pause Smalltalk processes until clipboard promises resolve.
   - Integration test: clipboard read during modal dialog without losing state.
3. **State synchronization**
   - Maintain a synchronized clipboard cache with timestamps to detect stale data.
   - Expose diagnostics UI to display last known clipboard contents and permission state.

## 6. Persistent Storage Resilience

### Goal
Provide robust file services even when IndexedDB is unavailable or quota-limited.

### Milestones
1. **Storage capability detection**
   - Probe IndexedDB, File System Access API, and localStorage availability at startup.
   - Log structured capability reports consumable by automated tests.
2. **Service worker-backed VFS**
   - Implement a service worker that mirrors VM file operations into Cache Storage with quota tracking.
   - Acceptance: offline replays of file reads/writes succeed after page reload.
3. **Quota monitoring**
   - Surface quota consumption and provide callbacks to Smalltalk when nearing limits.
   - Add stress tests that simulate quota exhaustion and ensure graceful recovery.
4. **Sync reconciliation**
   - Build a background task that reconciles IndexedDB/localStorage/Cache entries, repairing orphaned files.
   - Verify integrity via checksum audits.

## 7. Media Access Fallbacks

### Goal
Offer alternative audio input/output paths when permissions or APIs fail.

### Milestones
1. **Output abstraction**
   - Introduce an AudioWorklet-based output path with SharedArrayBuffer support.
   - Benchmark latency versus existing Web Audio nodes.
2. **Input alternatives**
   - Provide file-based or synthetic microphone sources selectable by the image.
   - Unit test: record/playback loop using synthetic source.
3. **Permission UX**
   - Display permission rationale modals and retry guidance when `getUserMedia` is blocked.
   - Capture analytics on user responses to refine flows.

## 8. Progressive Image Loading

### Goal
Reduce time-to-interactivity for large images through streaming.

### Milestones
1. **Chunk reader abstraction**
   - Refactor `vm.image.js` to read from async iterators that emit byte ranges.
   - Ensure existing synchronous path remains intact for compatibility.
2. **Incremental object install**
   - Adjust object table population to commit partial heaps while streaming.
   - Acceptance: UI becomes responsive before full image download completes.
3. **Error recovery**
   - Handle mid-stream failures by resuming downloads or rolling back partial loads.
   - Add tests simulating network interruptions.

## Tracking and Verification
- **Progress tracking:** Maintain a `docs/progress/browser_vm_resilience.md` checklist updated per milestone completion with timestamps, commit hashes, and validation notes.
- **Automated verification:** For each milestone, add or extend tests (unit/integration/benchmark) whose pass criteria confirm completion.
- **Reporting cadence:** After each Codex iteration, update the progress document and include relevant benchmark/log outputs.

This plan ensures each gap is closed through measurable steps, enabling Codex to iteratively deliver a resilient, high-fidelity browser-based Squeak VM.
