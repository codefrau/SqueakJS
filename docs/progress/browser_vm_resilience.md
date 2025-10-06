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

### Milestone 1: Format detection audit
- Status: ✅ Completed
- Last Updated: 2025-10-19
- Commit: pending (current PR)
- Notes: Added an image header audit pipeline that records probe attempts, logs unsupported combinations such as 64-bit non-Spur
  images, and emits operator guidance describing how to convert legacy images before retrying.

### Milestone 2: Conversion toolchain
- Status: ✅ Completed
- Last Updated: 2025-10-20
- Commit: pending (current PR)
- Notes: Shipped a `convert-image` Node CLI that upgrades the mock non-Spur 64-bit
  fixtures to Spur headers, records conversion flags, and emits machine-readable
  summaries. Added regression coverage that exercises the CLI against the
  compatibility fixture to validate object and selector counts before/after
  conversion.

### Milestone 3: Native loader path
- Status: ✅ Completed
- Last Updated: 2025-10-21
- Commit: pending (current PR)
- Notes: Implemented a native compatibility loader that detects the mock 64-bit non-Spur
  image metadata, reconstructs object/selector summaries, and auto-resolves loads across both
  buffer and streaming pipelines with audit logging and regression coverage.

### Milestone 4: Documentation & migration guide
- Status: ✅ Completed
- Last Updated: 2025-10-23
- Commit: pending (current PR)
- Notes: Published the end-to-end migration guide with runnable CLI examples, CI automation notes, native loader validation,
  and troubleshooting tables. Added a README pointer so operators can discover the guide from the main documentation index.

## 5. Clipboard Reliability

### Milestone 1: Async Clipboard API integration
- Status: ✅ Completed
- Last Updated: 2025-10-27
- Commit: pending (current PR)
- Notes: Added a reusable `vm.clipboard.js` bridge that wraps `navigator.clipboard` with permission gating, gesture heuristics, and fallback messaging for both main-thread and worker interpreters. Updated browser and worker hosts to use the bridge, cache stale clipboard data when APIs are denied, and surface structured status events. Landed automated coverage in `tests/worker-input/channel.test.mjs` and `tests/worker-input/clipboard-permissions.test.mjs` to exercise denied-permission flows and cached fallbacks.

### Milestone 2: Background request queue
- Status: ✅ Completed
- Last Updated: 2025-10-28
- Commit: pending (current PR)
- Notes: Introduced a shared clipboard request queue that serializes read/write operations across the main thread and worker host, automatically reusing freeze continuations so Smalltalk processes pause until asynchronous clipboard promises settle. Browser display handlers now return structured results even outside direct user gestures, worker bridges proxy queued responses, and new coverage in `tests/worker-input/clipboard-queue.test.mjs` verifies queued reads and writes resolve in order without losing cached state.

### Milestone 3: State synchronization
- Status: ✅ Completed
- Last Updated: 2025-10-29
- Commit: pending (current PR)
- Notes: Clipboard caches now track timestamps across the browser UI, worker host, and worker display so stale updates are discarded and recorded for diagnostics. A `SqueakDebugClipboard` overlay surfaces live permission state, queue depth, cached text previews, and error counters, while the new `primitiveClipboardDiagnostics` primitive exposes the same JSON snapshot for headless automation. Error counts persist to local storage and worker diagnostics mirror host state, with automated coverage in `tests/worker-input/clipboard-state.test.mjs` exercising stale detection and merged snapshots.

## 6. Persistent Storage Resilience

### Milestone 1: Storage capability detection
- Status: ✅ Completed
- Last Updated: 2025-10-26
- Commit: pending (current PR)
- Notes: Landed `vm.storage.capabilities.js` with sequential probes, caching, and telemetry hooks. Browser and worker startup now await `ensureStorageCapabilityReport()` (`squeak.js`, `vm.worker.host.js`, `vm.worker.entry.js`) so capability reports propagate across threads and emit `storage-capability-report` messages. Automated probe unit tests remain a follow-up task captured in the playbook next steps.

### Milestone 2: Service worker-backed VFS
- Status: ✅ Completed
- Last Updated: 2025-10-30
- Commit: pending (current PR)
- Notes: Added `vm.storage.vfs.js` and `run/squeak-storage-sw.js` to register a Cache Storage-backed virtual file system, mirror writes/deletes/renames from `vm.files.browser.js`, and replay cached entries before the VM boots. `squeak.js` now waits for VFS registration (with configurable scope/script/cache options) and exposes `SqueakJS.getStorageVFSState()` for diagnostics. `tests/storage/storage-vfs.test.mjs` exercises queue flushing, rename/delete propagation, and replay hydration using a stubbed service worker runtime.

### Milestone 3: Quota monitoring
- Status: ✅ Completed
- Last Updated: 2025-10-31
- Commit: pending (current PR)
- Notes: Introduced `vm.storage.quota.js` with a polling monitor that normalizes `navigator.storage.estimate` usage, mirrors the VFS manifest, and emits threshold events with optional semaphore signals for Smalltalk. The quota layer now plans LRU- and extension-aware evictions, proxies requests through the VFS queue, and records completion telemetry from the service worker. New primitives expose quota state and event drains, while `tests/storage/storage-quota.test.mjs` drives synthetic pressure to validate threshold notifications, eviction workflows, and manifest updates.

## 7. Media Access Fallbacks

### Milestone 1: Output abstraction
- Status: ✅ Completed
- Last Updated: 2025-11-01
- Commit: pending (current PR)
- Notes: Replaced the legacy buffer-source scheduler with an `AudioOutputManager` that prefers an AudioWorklet + SharedArrayBuffer ring buffer, falling back to buffer sources when modules fail or isolation is unavailable. Worker-ready tests simulate worklet success, worklet rejection, and legacy-only browsers to confirm semaphore callbacks fire and buffer accounting matches expectations.

### Milestone 2: Input alternatives
- Status: ✅ Completed
- Last Updated: 2025-11-02
- Commit: pending (current PR)
- Notes: Introduced an `AudioInputManager` with synthetic tone and file-backed
  recording sessions that images can select via
  `snd_primitiveSoundConfigureRecordingSource`. Added JS helpers to register PCM
  assets, emit diagnostics, and drive ScriptProcessor nodes without
  `getUserMedia`. Automated coverage in
  `tests/media/audio-input-manager.test.mjs` records the synthetic generator and
  verifies looped playback from a registered file buffer.

### Milestone 3: Permission UX
- Status: ☐ Not started

## 8. Progressive Image Loading
- All milestones: ☐ Not started

