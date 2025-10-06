# Media Access Resilience Playbook

This playbook documents the hardening work for the "Media Access Fallbacks"
track of the browser VM resilience roadmap. It captures design constraints,
implementation notes, diagnostics surfaces, and validation steps required to
industrialize audio pipelines across browsers with divergent security models.

## Goals

* Provide a SharedArrayBuffer-backed AudioWorklet output path that reduces
  latency and tolerates worker-hosted execution.
* Detect browsers that cannot host AudioWorklet modules (due to permission,
  isolation, or capability gaps) and fall back to script-node scheduling without
  breaking Smalltalk semantics.
* Surface buffer accounting and underrun telemetry so the VM can diagnose audio
  starvation or release back-pressure via semaphores.
* Offer microphone alternatives (synthetic tone generators and file-backed
  sources) so images can continue recording when `getUserMedia` is unavailable
  or denied.

## Architecture Overview

### AudioOutputManager

`AudioOutputManager` is installed on `Squeak.audio`. It lazily instantiates an
`AudioContext` (reusing vendor-prefixed constructors when necessary) and probes
for AudioWorklet + SharedArrayBuffer support in a dedicated detection context.
When support is available, it prepares an AudioWorklet-backed session; otherwise
it immediately uses the legacy buffer-source session.

Key responsibilities:

* Serialize session creation so repeated `start` calls recycle an existing
  `AudioContext` while dropping any stale sessions.
* Cache the `addModule` promise for the dynamically generated worklet script so
  multiple starts do not re-register identical processors.
* Expose `audioOutputDiagnostics()` for future Smalltalk-facing tooling to
  query whether the worklet path is active.

### Worklet Session

When AudioWorklet support is detected, the manager creates an
`AudioOutputWorkletSession`. The session allocates:

* A SharedArrayBuffer-backed `Float32Array` ring buffer sized at four times the
  requested Smalltalk buffer length (with one frame reserved to disambiguate
  empty vs. full conditions).
* A SharedArrayBuffer-backed `Int32Array` with read/write indices managed via
  `Atomics` to guarantee coherence between the main thread and the worklet.

The dynamically generated worklet processor pulls audio frames from the ring
buffer, emits underrun telemetry, and posts periodic "freed" messages so the VM
can release waiting Smalltalk producers. If module registration fails, the
session instantiates a legacy session internally and delegates all future calls
through it.

### Legacy Session

The legacy path mirrors the pre-refactor behavior: it maintains a pool of
`AudioBuffer` instances sized to the requested frame count, schedules them via
`createBufferSource`, and uses `setTimeout` to return buffers to the free list
once playback should have completed. The pool size has been increased to three
buffers to reduce underrun risk when browsers throttle timers.

### AudioInputManager

`AudioInputManager` now sits alongside the output manager on `Squeak.audio`. It
centralizes microphone access and offers two resilience-focused alternatives:

* **Synthetic tone session** – Generates deterministic sine waves entirely in
  JavaScript, driving the ScriptProcessor node directly so audio remains
  available in sandboxed or automation contexts.
* **File-backed session** – Replays previously registered PCM buffers (looping
  by default) so prerecorded prompts or fixtures can stand in for a missing
  microphone.

The manager exposes `configureAudioInput`, `registerAudioInputFile`, and
`audioInputDiagnostics` helpers. Images can switch sources via the new
`snd_primitiveSoundConfigureRecordingSource` primitive, while JS harnesses can
preload PCM assets for the file-backed path. Diagnostics capture the active
mode, registered file identifiers, and session-specific metadata so tooling can
surface fallback status to operators.

### Permission UX overlay

`vm.media.permissions.js` introduces a lightweight overlay that appears when the
browser blocks `getUserMedia` requests. The UI explains why the microphone was
denied, provides actionable guidance (re-enabling the permission prompt or
choosing a synthetic source), and offers a one-click fallback to the synthetic
input pipeline. Each interaction records analytics entries (prompt shown,
retry/fallback selections, dismissals) which dispatch a
`squeak.mediaPermissionAnalytics` event for external observers. The UX can also
be driven programmatically during automated tests through
`Squeak.ensureMediaPermissionUX().selectPromptAction(...)`, allowing harnesses
to simulate user choices without a DOM.

## Diagnostics & Telemetry

* `Squeak.audioOutputDiagnostics()` returns a JSON snapshot reporting whether an
  `AudioContext` exists, which session type is active, and whether the worklet
  path was available during detection.
* `Squeak.audioInputDiagnostics()` mirrors the same concept for recording,
  reporting the configured mode, registered file sources, and the diagnostics of
  the live session (frequency/amplitude for synthetic tones or file IDs for
  buffer playback).
* The worklet processor posts `underrun` messages when zero-fill playback
  occurs. These are logged to the console today and will feed future telemetry
  sinks.
* Buffer release callbacks map to the Smalltalk semaphore index provided during
  `snd_primitiveSoundStartWithSemaphore`, ensuring audio producers resume as
  soon as buffers return to the pool.

## Validation

Automated coverage is provided by:

* `tests/media/audio-output-manager.test.mjs`, which exercises three scenarios:
  1. **Worklet success path** – verifies capacity math, enqueue behavior, and
     semaphore callback delivery when the worklet is available.
  2. **Worklet fallback** – simulates a rejected `addModule` call to ensure the
     session transparently delegates to the legacy buffer scheduler.
  3. **Legacy-only browsers** – disables AudioWorklet support to confirm
     initialization succeeds and legacy scheduling still releases buffers.
* `tests/media/audio-input-manager.test.mjs`, which feeds the synthetic tone
  session through the ScriptProcessor recording path, verifies diagnostics, and
  validates the file-backed looped playback source.

Manual validation steps:

1. Load `demo/simple.html` in a cross-origin-isolated context and trigger the
   Squeak "beep" primitive to confirm the worklet path produces audible output.
2. Repeat in a non-isolated context (e.g., local file URL) to ensure the system
   falls back to the legacy path without throwing errors.
3. Use the new recording source primitive to switch to the synthetic generator
   and confirm `snd_primitiveSoundRecordSamples` delivers non-zero buffers
   without a microphone permission prompt.
4. Register a short PCM clip via `Squeak.registerAudioInputFile` and verify that
   switching to the file source yields looped buffers while diagnostics report
   the active file ID.
5. Observe console logs for underrun warnings while forcing the tab into the
   background to validate telemetry emission.

## Next Steps

* Layer a permission request UX around `getUserMedia` calls and record user
  responses for telemetry-driven iteration.
