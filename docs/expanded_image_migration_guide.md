# Expanded Image Migration Guide

This guide explains how to evaluate, convert, and run legacy Smalltalk images in the browser-hosted Squeak VM. It consolidates the
runtime compatibility matrix, runnable conversion examples, telemetry touchpoints, and validation steps required to industrialize
image onboarding.

## 1. Support Matrix

| Image family | Word size | Endianness | Loader path | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Spur | 32-bit | Little | Standard `Squeak.Image` loader | ✅ Supported | Default path for modern Squeak/Pharo images with Spur headers.
| Spur | 64-bit | Little | Standard `Squeak.Image` loader | ✅ Supported | Runs through `_finalizeImageLoad` once headers pass `detectImageHeader`.
| Traditional (pre-Spur) | 32-bit | Little | Standard `Squeak.Image` loader | ✅ Supported | Header parsing flows through the non-Spur branch that reconstructs legacy object memory.
| Traditional (pre-Spur) | 64-bit | Little | Native compatibility loader | ✅ Supported via snapshot bridge | `tryLoadNativeCompatibilityImageFromBuffer` hydrates a snapshot and avoids the fatal `"64 bit non-spur images not supported yet"` path.
| Any | Any | Any | Native compatibility loader | ⚠️ Requires metadata | Loader expects compatibility metadata (`IMCK` magic). Without it the request falls back to standard parsing and surfaces `unsupported-nonspur-64`.
| Unknown / truncated | Any | Any | Audit guardrail | ❌ Blocked | `ImageHeaderAudit` reports `insufficient-bytes` or `unrecognized-version` with remediation guidance.

**Telemetry:** The loader attaches an `ImageHeaderAudit` instance to each `Squeak.Image`. Inspect `image.headerAudit.probes`,
`issues`, and `resolutions` to capture detection results and the loader path taken.

## 2. Conversion Workflow with `tools/convert-image.mjs`

Follow these steps to convert non-Spur 64-bit images into Spur headers while retaining compatibility metadata.

1. **Prepare the source image.** Ensure the input is a 64-bit non-Spur image augmented with the compatibility metadata block. The
   repository ships a mock fixture under `tests/fixtures/nonspur64-mock.js` for validation scenarios.
2. **Run the converter.** Invoke the CLI with the `convert` subcommand. The destination defaults to `<name>.spur64.image` but can be
   supplied explicitly.

   ```bash
   node tools/convert-image.mjs convert ./tmp/nonspur64.image ./tmp/nonspur64.spur64.image --summary=table
   ```

   Sample output:

   ```
   Conversion summary
   ==================
   Input:  /workspace/SqueakJS/tmp/nonspur64.image
   Output: /workspace/SqueakJS/tmp/nonspur64.spur64.image

   Image:
     Version: 68000 -> 68016
     Spur:    no -> yes
     Objects: 3
     Selectors: 2
   ```

3. **Inspect JSON summaries.** Switch to `--summary=json` to capture machine-readable details (object/selector counts, metadata
   offsets, flags) for automated regression tracking.

   ```bash
   node tools/convert-image.mjs convert ./tmp/nonspur64.image --summary=json --force
   ```

4. **Validate invariants.** After conversion, compare object and selector counts and confirm the Spur bit was added. The CLI embeds
   these assertions in its JSON output so CI jobs can flag deviations quickly.
5. **Handle re-runs.** The converter refuses to overwrite existing files unless `--force` is supplied. This prevents silent
   clobbering when pipelines are re-executed.

### Automation hooks

Add a CI step that emits the JSON summary and persists it as a build artifact:

```bash
node tools/convert-image.mjs convert "$IMAGE" --summary=json > reports/$IMAGE.json
```

To enforce parity in GitHub Actions, use `jq` to compare the emitted totals with expected baselines before uploading artifacts.

## 3. Native Compatibility Loader Usage

The browser VM hydrates supported non-Spur 64-bit images without external conversion by capturing the metadata snapshot and
exposing it through `image.compatibilitySnapshot`.

1. **Instantiate the VM image:**

   ```javascript
   const image = new Squeak.Image("legacy", {
       headroomMB: 64,
       gcThresholdMB: 12,
       youngSpaceRatio: 0.25,
   });
   ```

2. **Load from a buffer:**

   ```javascript
   await new Promise((resolve, reject) => {
       try {
           image.readFromBuffer(arrayBuffer, resolve, progress => {
               console.log("progress", progress);
           });
       } catch (error) {
           reject(error);
       }
   });
   ```

3. **Validate post-load state:**
   - `image.compatibilityMode` should equal `"native-nonspur64"` when the compatibility loader handled the image.
   - `image.compatibilitySnapshot.metadata.objects.total` and `.selectors.total` mirror the metadata block.
   - `image.headerAudit.resolutions` includes a `native-compat-loader` entry while `issues` remains empty.

4. **Streamed loads:** Pass an async iterator to `image.readFromStream(...)` for chunked downloads. The loader records the remaining
   bytes via `CompatibilityImageRecorder` to finalize the snapshot once streaming completes.

5. **Hosting guidance:** Serve compatibility images with `application/octet-stream` or `application/x-squeak-image` MIME types and
   enable range requests so streaming loaders can resume efficiently. Cache-control headers should align with your deployment
   cadence because converted images are immutable artifacts.

## 4. Troubleshooting Playbook

Use loader telemetry to diagnose failures quickly.

| Symptom | Audit code | Typical cause | Corrective action |
| --- | --- | --- | --- |
| Loader throws `"64 bit non-spur images not supported yet"` | `unsupported-nonspur-64` | Image lacks compatibility metadata or compatibility loader disabled | Run the conversion CLI, verify metadata block, or regenerate the image from a Spur VM export.
| Loader logs truncated header | `insufficient-bytes` | Partial download or truncated file | Re-download the asset and confirm the server delivers the full byte range.
| Loader reports `unrecognized` version | `unrecognized-version` | Header word not in `IMAGE_HEADER_BASE_VERSIONS` | Audit the probes, check if the image uses an unsupported VM fork, and route through native desktop conversion first.
| Conversion CLI refuses overwrite | _n/a_ | Destination already exists | Re-run with `--force` after confirming the target should be replaced.

For each audit entry, capture `entry.details` and attach them to your incident tracking system so repeated issues can be correlated.

## 5. Validation & Regression Strategy

| Scenario | Command | Expected result |
| --- | --- | --- |
| Conversion parity | `node tests/image/conversion-toolchain.test.mjs` | Verifies the CLI preserves object and selector counts, sets the Spur bit, and blocks reconversion.
| Native loader coverage | `node tests/image/native-loader-path.test.mjs` | Exercises both buffer and streaming paths, ensuring compatibility snapshots hydrate correctly and audit logs capture the resolution.
| Header telemetry | `node tests/image/header-audit.test.mjs` | Confirms audit probes/issue reporting for truncated and unsupported headers.

Integrate these commands into your CI pipeline so regressions in loader behavior or metadata handling surface immediately.

## 6. Change Management

- **Versioning:** Tag updates to this guide alongside VM releases (for example, `docs@vm-x.y.z`). Include references to commit hashes
  when documenting new compatibility scenarios.
- **Communication cadence:** When deprecating formats, announce timelines in release notes and link back to this guide so operators
  can execute conversion workflows ahead of enforcement.
- **Future enhancements:** Once analytics hooks are available, instrument access patterns to the troubleshooting section to
  prioritize localized content and additional decision-tree branches.
