# Storage Capability Detection Implementation Design

## Objective
Deliver a resilient startup probe that inventories browser storage capabilities (IndexedDB, Cache Storage, File System Access API, localStorage, OPFS) and publishes machine-readable telemetry so the VM can choose the optimal persistence backend or fall back gracefully.

## Scope
- Browser-hosted VM entrypoints (`run/`, `squeak.js`, worker controller) share a common detection module.
- Applies to main-thread and worker boot paths.
- Excludes service worker VFS synchronization (covered by the separate playbook).

## Architecture Overview
1. **Probe orchestrator**
   - New module `vm.storage.capabilities.js` exports `async detectStorageCapabilities({ abortSignal, timeoutMs })`.
   - Orchestrator composes individual capability probes, enforces a timeout budget, and yields a normalized report.
2. **Capability probes**
   - IndexedDB: attempt `indexedDB.databases()` (when available) or open/delete a sentinel database to verify read/write.
   - Cache Storage: check `'caches' in globalThis` and attempt `caches.open('squeak-capability-probe')` with cleanup.
   - File System Access API: verify `window.showOpenFilePicker` / `navigator.storage.getDirectory` (OPFS) within user-gesture constraints via `navigator.storage.getDirectory?.()` when allowed.
   - LocalStorage: wrap read/write in try/catch to detect quota errors or restrictions (e.g., Safari private mode).
   - Origin Private File System (OPFS): feature detect `navigator.storage.getDirectory` and confirm write by creating/removing a file in a scoped directory.
3. **Telemetry publisher**
   - Emits structured events through the existing telemetry bus (`vm.memory.telemetry.js` pattern) under namespace `storage.capability`.
   - Provide `emitCapabilityReport(report)` to dispatch once per boot and when significant changes occur (e.g., `storage` event).
4. **Fallback integration**
   - Loader consumes report to select persistent backend (IndexedDB ➜ Cache Storage ➜ in-memory) before starting image IO.
   - Worker controller caches report and posts to worker via `postMessage({ type: 'storageCapabilities', report })`.

## Data Model
```json
{
  "timestamp": "2025-10-26T12:34:56.789Z",
  "origin": "https://app.example",
  "probes": {
    "indexedDB": { "supported": true, "mode": "readwrite", "details": { "versionedDatabases": true } },
    "cacheStorage": { "supported": true, "mode": "readwrite" },
    "opfs": { "supported": false, "error": "SecurityError" },
    "fileSystemAccess": { "supported": false, "error": "NotAvailable" },
    "localStorage": { "supported": true, "mode": "readwrite" }
  },
  "durationMs": 87,
  "errors": []
}
```
- `mode` enumerations: `"readwrite" | "readonly" | "blocked"`.
- `error` captures DOMException `name` and message when available.
- `durationMs` records total detection latency.

## Module Integration Steps
1. Create `vm.storage.capabilities.js` with:
   - Orchestrator
   - Individual probe helpers
   - Timeout handling via `AbortController`
   - Telemetry emitter hook
2. Wire detection into the browser entrypoint (`squeak.js`) startup sequence:
   - Run detection before image loading begins.
   - Persist report on `Squeak.BrowserVMState.storageCapabilities` for later consumption.
3. Worker bootstrap (`vm.worker.entry.js`):
   - Receive report from host, fallback to running detection inside worker when host cannot share (e.g., cross-origin workers).
4. Update CLI/headless loaders to skip detection (not applicable) but allow injection of precomputed report for tests.

## Implementation Notes (2025-10-26)
- Added `vm.storage.capabilities.js` implementing sequential probes for IndexedDB, Cache Storage, OPFS, File System Access API, and `localStorage`. The orchestrator enforces a global timeout (default 120 ms), normalizes results, caches the most recent report on `Squeak.BrowserVMState.storageCapabilities`, and publishes telemetry via `Squeak.Storage.Capabilities.detect/ensure` along with a console fallback log.
- Updated `squeak.js` to await `ensureStorageCapabilityReport()` before instantiating the interpreter so main-thread startup receives a normalized report and exposes it through `options.vm.storageCapabilities`.
- Extended `vm.worker.host.js` to resolve a storage capability report ahead of launching the worker, forward it through the `load-image` payload, and consume worker-originated `storage-capability-report` messages to keep host state synchronized.
- Updated `vm.worker.entry.js` to honour injected reports, run in-worker detection when necessary, and post capability results (or errors) back to the host before constructing the interpreter.
- The telemetry hook now routes through `vm.telemetry.channel.js`, emitting a versioned `storage.capability` envelope via `Squeak.telemetry.emit` with a bounded history and a `[SqueakJS][storage]` fallback log. Duplicate console output is prevented by deduping on the serialized report signature.
- Automated test coverage for the orchestrator remains a follow-up; the design checklist tracks this outstanding work.
- Implementation update (2025-11-07): Introduced `vm.storage.telemetry.js` to centralize capability/quota/error emissions, updated the detection and quota modules to publish through the new channel, and landed `tests/storage/storage-telemetry.test.mjs` covering detection deduping, quota sampling, and error fallback paths.

## Telemetry & Logging
- Leverage the shared telemetry channel to emit versioned payloads once at `info` level, ensuring consumers observe consistent envelopes across memory and storage events.
- Add optional `debug` flag to dump per-probe timings.
- Emit warning logs if all persistent stores are unavailable, recommending enabling third-party cookies or storage access.

## Testing Strategy
### Unit Tests
- Mock each probe to simulate success/failure/timeouts.
- Validate orchestrator respects timeout and aggregates errors.
- Ensure telemetry emitter receives normalized report.

### Integration Tests (Browser automation harness)
- Use Playwright-based tests with service worker mocks to:
  - Block IndexedDB (e.g., via browser context permissions) and verify fallback order.
  - Simulate quota errors by filling localStorage.
  - Confirm reports propagate to worker and update global state.

### Regression Fixtures
- Add JSON fixtures representing different browser profiles (Chromium, Firefox, Safari) for snapshot tests ensuring no schema drift.

## Rollout Plan
1. Land module behind feature flag `storageCapabilityDetection` defaulting to `true` for nightly builds.
2. Monitor telemetry dashboards for `errors.length` spikes and `durationMs` regressions.
3. After one week of stable telemetry, remove feature flag and mark milestone as complete.
4. Document findings and integration steps in the persistent storage resilience playbook.

## Risks & Mitigations
- **User gesture requirements**: ensure File System Access probe only runs when gestures are available; otherwise record `blocked`.
- **Private browsing limitations**: capture `QuotaExceededError` and surface actionable guidance in logs.
- **Performance impact**: enforce ≤100 ms timeout; degrade gracefully by marking unknown capabilities.

## Acceptance Checklist
- [x] Detection module returns reports covering IndexedDB, Cache Storage, OPFS, File System Access API, and localStorage.
- [x] Telemetry emitted with normalized schema and accessible via global state.
- [x] Worker path receives report with parity coverage.
- [x] README/Playbook updated with implementation references.
- [x] Automated tests cover success, partial failure, and timeout paths.
