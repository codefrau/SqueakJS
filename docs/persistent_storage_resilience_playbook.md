# Persistent Storage Resilience Playbook

This playbook hardens the browser VM's persistent storage facilities so projects can reliably save images, changes,
and assets even when platform capabilities vary. It breaks the "Persistent Storage Resilience" roadmap stream into
concrete deliverables, validation steps, and rollout guidance.

## 1. Objectives
- Maintain functional file services when IndexedDB is missing, blocked, or quota-limited.
- Provide predictable failure modes and clear operator guidance for degraded scenarios.
- Instrument the storage stack to detect quota and capability regressions before they impact users.
- Ship a migration timeline that allows hosted deployments to adopt new storage layers incrementally.

## 2. Scope
- Browser runtime only; Node/headless storage remains out of scope for this milestone.
- Squeak image persistence APIs that rely on the browser file system facade.
- IndexedDB, Cache Storage, File System Access API, localStorage fallbacks, and in-memory emergency buffers.
- Telemetry, alerts, and administrative tooling associated with persistent storage state.

## 3. Stakeholders & Consumers
- Hosted VM operators running Squeak/Etoys images in managed browsers.
- Educators and authors relying on auto-save/change logs in classrooms.
- Codex maintainers responsible for the VM storage pipeline and supporting tooling.
- Security and compliance reviewers verifying quota and permission usage.

## 4. Deliverables & Milestones
1. **Capability detection & baseline telemetry**
   - Implement feature probes for IndexedDB, Cache Storage, File System Access API, and localStorage with structured logging.
   - Expose a storage capability report through the VM diagnostics console and `vmParameterAt:`.
   - Instrument quota usage snapshots and warning thresholds.
   - Document capability matrix, known browser quirks, and fallback expectations in README and operator docs.
2. **Service worker-backed virtual file system (VFS)**
   - Introduce a service worker that mirrors VM file operations into Cache Storage, reconciling with IndexedDB when available.
   - Provide atomic write semantics using temporary entries and commit markers.
   - Add offline replay tests that load an image, perform writes, reload the page, and verify persisted state.
   - Ship migration instructions for hosting environments (headers, scope, registration timing).
   - _Implementation snapshot (2025-10-30):_ `vm.storage.vfs.js` registers `run/squeak-storage-sw.js`, mirrors browser file API updates, and replays cached files before the VM boots. `tests/storage/storage-vfs.test.mjs` exercises the queue, rename/delete flows, and replay hydration with a stubbed service worker runtime.
3. **Quota monitoring & adaptive policies**
   - Surface live quota consumption metrics in the diagnostics console and telemetry hooks.
   - Provide callbacks/notifications to Smalltalk when quotas near configurable thresholds.
   - Implement eviction heuristics (LRU by path, type-aware compaction) to free space while preserving critical assets.
   - Validate behavior with synthetic quota exhaustion harnesses that exercise IndexedDB and Cache Storage pressure.
   - _Implementation snapshot (2025-10-31):_ `vm.storage.quota.js` installs a polling estimator that merges `navigator.storage.estimate`
     with the Cache Storage manifest, dispatches threshold events, and coordinates eviction requests through the VFS queue.
     New storage primitives expose quota state and warning semaphores to Smalltalk, while `tests/storage/storage-quota.test.mjs`
     simulates quota pressure to validate notifications and eviction results emitted by `run/squeak-storage-sw.js`.
4. **Sync reconciliation and repair tooling**
   - Build background tasks to reconcile IndexedDB/localStorage/Cache entries, repairing orphaned or divergent files.
   - Add checksum audits and repair reports accessible via diagnostics UI and CLI utilities.
   - Provide admin workflows for exporting/importing storage snapshots for disaster recovery.
   - Document operational runbooks (alert responses, manual reconciliation steps, rollback procedures).
   - _Implementation snapshot (2025-11-08):_ `vm.storage.reconcile.js` coordinates background reconciliation runs triggered by service worker manifest updates, repairing missing local files from cached snapshots, re-registering local-only entries, emitting telemetry, and covered by `tests/storage/storage-reconcile.test.mjs` to exercise recovery and scheduling paths.

## 5. Implementation Tasks
- [x] Land capability detection module with promise-based probes and structured result schema.
  - ✅ `vm.storage.capabilities.js` orchestrates IndexedDB, Cache Storage, OPFS, File System Access API, and `localStorage` probes, caches reports on `Squeak.BrowserVMState`, and exposes helpers under `Squeak.Storage.Capabilities`.
  - 📄 Implementation design: see `storage_capability_detection_design.md` for module architecture, telemetry schema, and acceptance checklist.
- [x] Add storage telemetry channel that emits JSON records for capability states, quota usage, and error events.
  - ✅ Introduced `vm.storage.telemetry.js` with helpers that normalize capability, quota-sample, quota-event, and error payloads
    before routing them through `Squeak.telemetry` or console fallbacks.
  - ✅ Updated `vm.storage.capabilities.js` and `vm.storage.quota.js` to publish telemetry for capability detections, quota samples,
    threshold events, eviction plans, and error conditions.
  - ✅ Added `tests/storage/storage-telemetry.test.mjs` to exercise capability deduping, quota sampling, threshold emission, and
    error fallback behaviour end-to-end.
- [x] Extend VM file APIs to delegate through a pluggable backend supporting IndexedDB, Cache Storage, and in-memory modes.
- [x] Create service worker script with request routing, atomic write protocol, and cache reconciliation logic.
- [x] Develop integration tests that simulate offline reloads, quota exhaustion, and API permission denials.
- [ ] Implement diagnostics UI panels for storage health, including capability matrix, quota gauges, and recent errors.
- [ ] Provide CLI tooling (Node-based) for snapshot export/import and reconciliation status dumps.
- [ ] Update README/operator docs with deployment prerequisites, CSP headers, and migration phasing guidance.

## 6. Telemetry & Monitoring Plan
- Emit capability probe results and quota metrics to the existing telemetry collector with storage-specific tags.
- Add warning thresholds for 50%, 75%, 90% quota utilization with configurable notifications.
- Capture service worker sync events, reconciliation outcomes, and recovery actions for audit trails.
- Provide hooks for external monitoring (e.g., `window.vmStorage.onQuotaWarning`) so hosts can integrate alerts.

## 7. Testing & Validation Strategy
- Unit tests for capability probes with mocked browser APIs and failure modes.
- Integration suite covering:
  - IndexedDB available/unavailable permutations.
  - Service worker offline recovery and cross-tab synchronization.
  - Quota exhaustion scenarios that trigger eviction heuristics.
- Performance benchmarks measuring write latency and throughput across storage backends.
- Manual test scripts for browser-specific quirks (Safari private mode, Firefox storage partitioning).
- Regression gates that must pass before flipping service worker-backed VFS on by default.

## 8. Rollout & Change Management
- Phase 1: Ship capability detection and telemetry disabled by default behind feature flag; monitor telemetry dashboards.
- Phase 2: Enable service worker VFS for canary cohorts; collect offline replay metrics and quota warnings.
- Phase 3: Roll out adaptive quota policies and reconciliation tooling broadly; provide rollback flag and documentation.
- Phase 4: Deprecate legacy IndexedDB-only code path once telemetry confirms stability and operators have migrated.
- Maintain release notes summarizing storage changes, required host configuration, and known issues.

## 9. Open Risks & Mitigations
- **Service worker registration failures**: Provide host preflight checklists and fallback to legacy IndexedDB path if registration fails.
- **Quota variability across browsers**: Maintain per-browser default thresholds and allow host overrides via config.
- **Telemetry volume**: Batch storage telemetry events and offer sampling controls to avoid excessive logging.
- **Migration complexity**: Supply step-by-step runbooks, including validation commands and rollback steps for each deployment tier.

## 10. Next Steps
1. ✅ Ship capability detection module and host/worker integration (`vm.storage.capabilities.js`, `squeak.js`, `vm.worker.host.js`, `vm.worker.entry.js`).
2. ✅ Draft storage telemetry schema and integrate with existing logging infrastructure.
3. ✅ Add automated unit coverage for the capability detection orchestrator (success, failure, timeout scenarios).
4. Schedule implementation spikes for service worker VFS and quota monitoring harnesses.
5. Coordinate with documentation maintainers to publish operator-focused deployment guides alongside code changes.

