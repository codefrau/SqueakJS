# Clipboard Reliability Hardening Playbook

This playbook sequences the engineering work required to make clipboard
operations dependable across browsers, permission models, and execution
modes (main thread, worker, headless). It expands the "Clipboard
Reliability" workstream from `docs/browser_vm_resilience_plan.md`
into actionable tasks with instrumentation, validation, and rollout
expectations.

## 1. Problem Statement & Goals

### Objectives
- Guarantee that copy, paste, and clipboard-driven primitives work across
  modern Chromium, Firefox, and WebKit builds, including strict
  permission contexts.
- Offer transparent fallbacks with clear operator messaging when
  clipboard APIs are unavailable.
- Provide diagnostics hooks that help support teams triage clipboard
  failures without reproducing them locally.

### Non-Goals
- Replacing or modifying Smalltalk-level clipboard semantics.
- Implementing OS-level clipboard synchronization beyond browser
  capabilities.

## 2. Current State Assessment

| Area | Observations | Risk |
| --- | --- | --- |
| API usage | Legacy code still calls deprecated synchronous clipboard
  APIs gated by user gestures. | High: fails silently in Safari/Firefox
  when user gesture heuristics change.
| Worker contexts | Worker-hosted VM paths proxy clipboard requests
  synchronously through `postMessage` without permission handling. |
  Medium: requests race with permission prompts and drop data.
| Diagnostics | Logs only surface when `SqueakDebugVM` is enabled and
  provide minimal context. | Medium: difficult to debug incidents.

## 3. Milestone Breakdown & Acceptance

### Milestone 1 — Async Clipboard API integration
**Goal:** Adopt the async clipboard APIs with robust permission gating
and graceful fallback messaging.

**Implementation tasks**
1. Introduce a `ClipboardBridge` module that exposes `readText` and
   `writeText` returning promises.
2. Detect support for `navigator.clipboard` and
   `navigator.permissions?.query({ name: 'clipboard-read' | 'clipboard-write' })`.
3. Surface explicit user-facing prompts when permissions are denied or
   require gestures. Provide localized strings hook.
4. Update Smalltalk primitives to await promises via the existing
   `freeze` continuation helpers. Ensure timeouts bubble up as
   `ClipboardTimeout` VM errors with actionable messages.

**Instrumentation**
- Emit structured logs `clipboard.request`, `clipboard.permission`, and
  `clipboard.error` with correlation IDs when debug flags are enabled.
- Record latency metrics for fulfilled requests and expose them through
  the telemetry bus (`vm.execution.state` stream).

**Acceptance criteria**
- Manual test matrix across Chromium, Firefox, Safari verifying copy and
  paste succeed when permissions granted and fail with clear prompts when
  denied.
- Automated integration test simulating permission denial to assert
  fallback messaging and that the Smalltalk process resumes.

### Milestone 2 — Background request queue
**Goal:** Prevent state corruption when multiple clipboard operations are
in flight or Smalltalk waits on asynchronous responses.

**Implementation tasks**
1. Implement a queue in `ClipboardBridge` that serializes clipboard
   promises and resumes the VM in FIFO order.
2. Ensure the queue interoperates with worker proxy channels by tagging
   requests with sequence IDs and resolving responses in order.
3. Provide configuration for maximum wait duration and concurrency; emit
   warnings when limits are exceeded.

**Instrumentation**
- Track queue depth and wait duration via telemetry counters exposed to
  the diagnostics UI.
- Add `clipboard.queue.saturation` warnings when depth exceeds the
  configurable threshold.

**Acceptance criteria**
- Integration tests that issue concurrent copy/paste requests from
  Smalltalk and assert completion order as well as absence of deadlocks.
- Worker harness test verifying structured-clone payloads maintain
  sequence IDs during postMessage hops.

### Milestone 3 — State synchronization & diagnostics UI
**Goal:** Surface clipboard state, permission status, and recent errors
in a support-friendly format.

**Implementation tasks**
1. Maintain an in-memory cache with timestamped clipboard content
   previews (truncated to configurable length) and permission state.
2. Expose a diagnostics panel (or extend existing stats overlay) that
   displays last successful read/write timestamps, permission state, and
   outstanding queue depth.
3. Add a Smalltalk primitive to query the state cache for headless
   automation scripts.
4. Persist anonymized error counters to local storage so support teams
   can collect logs after incidents.

**Instrumentation**
- Extend telemetry stream with `clipboard.state` snapshots containing
  permission, lastAction, and failure counts.
- Include correlation IDs for bridging incidents reported from worker or
  host contexts.

**Acceptance criteria**
- Browser UI displays diagnostics overlay when `SqueakDebugClipboard` is
  enabled and updates in real time.
- Headless integration test confirms state primitive returns expected
  structure and error counters persist across reloads.

## 4. Testing Strategy

1. **Unit tests:** Add targeted coverage for `ClipboardBridge`
   serialization logic, permission detection fallbacks, and state cache
   updates.
2. **Integration tests:** Extend the browser harness to simulate granted
   and denied permission states via dependency injection. Validate
   message routing in worker mode using fake `postMessage` channels.
3. **Manual validation:** Document manual steps for verifying clipboard
   flows in Chromium, Firefox, Safari (desktop) and Chrome on Android.
4. **Regression suite:** Integrate new tests into `npm test` grouping so
   clipboard regressions run in CI and are tracked alongside other VM
   resilience checks.

## 5. Telemetry & Observability

- **Metrics:** Queue depth, permission state transitions, request
  latency, error counts by type.
- **Log schema:** JSON records with fields `component`, `event`,
  `requestId`, `mode`, `permission`, `durationMs`, `error`.
- **Dashboards:** Provide a Grafana-ready JSON definition that charts
  queue depth and failure rate for hosted deployments.
- **Alerts:** Define alert thresholds (e.g., >5 consecutive failures or
  permission-denied spikes) to trigger operator response.

## 6. Rollout & Change Management

1. **Development branches:** Land Milestone 1 behind a feature flag
   (`SqueakClipboardAsync`) to allow staged testing.
2. **Beta rollout:** Enable the flag on staging environments and collect
   telemetry for two weeks, ensuring queue depth and error rates remain
   within expected ranges.
3. **General availability:** Remove the feature flag once manual matrix
   completes and CI coverage is stable. Update README and release notes
   with clipboard diagnostics instructions.
4. **Post-launch follow-up:** Review telemetry after GA to identify
   browsers requiring additional shims or user education.

## 7. Dependencies & Risks

- Requires reliable `freeze` continuation primitives; regressions here
  will block async adoption.
- Some browsers (notably older Safari) lack permissions API support;
  fallback messaging must cover these gaps.
- Clipboard access in cross-origin iframes may remain unsupported; the
  playbook mandates documentation rather than engineering workarounds.

## 8. Future Enhancements

- Investigate shared clipboard channels between multiple VM instances via
  BroadcastChannel once hardened.
- Explore persisting clipboard history for power users once privacy
  review is completed.
- Consider adding analytics correlation between clipboard failures and
  other permission prompts (camera, microphone) to improve UX flows.
