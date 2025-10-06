import test from "node:test";
import assert from "node:assert/strict";

import {
  WORKER_TELEMETRY_NAMESPACE,
  configureWorkerTelemetry,
  getWorkerTelemetryChannelState,
  recordWorkerFeatureReportEvent,
  resetWorkerTelemetry
} from "../../vm.worker.telemetry.js";

test("records sanitized telemetry metrics for worker feature reports", () => {
  resetWorkerTelemetry({ bufferLimit: 8, version: 2 });

  recordWorkerFeatureReportEvent({
    requestId: 5,
    roundTripMs: 42,
    detectionDurationMs: 12,
    detectionStatus: "success",
    throttling: {
      budget: 3,
      remaining: 2,
      interval: 1000,
      reason: "timer",
      extra: "ignored"
    },
    errors: [
      { message: "permission denied", code: "worker-denied", severity: "warning" },
      "string-error"
    ],
    resourceCapabilityError: { message: "cap denied", code: "cap-denied" },
    workerErrors: 2,
    mainThreadDependencyCount: 4
  });

  const state = getWorkerTelemetryChannelState();
  assert.ok(state);
  assert.strictEqual(state.namespace, WORKER_TELEMETRY_NAMESPACE);
  assert.strictEqual(state.bufferLimit, 8);
  assert.strictEqual(state.version, 1);
  assert.strictEqual(state.history.length, 1);

  const event = state.history[0];
  assert.strictEqual(event.namespace, WORKER_TELEMETRY_NAMESPACE);
  assert.strictEqual(event.type, "feature-report");
  assert.strictEqual(event.version, 1);

  const payload = event.payload;
  assert.ok(payload);
  assert.strictEqual(payload.requestId, 5);
  assert.strictEqual(payload.status, "degraded");
  assert.deepStrictEqual(payload.detection, { status: "success", durationMs: 12 });
  assert.ok(payload.throttling);
  assert.strictEqual(payload.throttling.reason, "timer");
  assert.strictEqual(payload.throttling.interval, 1000);
  assert.strictEqual(payload.throttling.budget, 3);
  assert.strictEqual(payload.throttling.remaining, 2);
  assert.strictEqual(payload.throttling.extra, undefined);
  assert.ok(Array.isArray(payload.errors));
  assert.strictEqual(payload.errors.length, 2);
  assert.deepStrictEqual(payload.errors[0], {
    message: "permission denied",
    code: "worker-denied",
    severity: "warning"
  });
  assert.deepStrictEqual(payload.errors[1], { message: "string-error" });
  assert.deepStrictEqual(payload.resourceCapabilityError, {
    message: "cap denied",
    code: "cap-denied"
  });

  const metrics = payload.metrics;
  assert.ok(metrics);
  assert.strictEqual(metrics.roundTripMs, 42);
  assert.strictEqual(metrics.detectionDurationMs, 12);
  assert.strictEqual(metrics.workerErrors, 2);
  assert.strictEqual(metrics.mainThreadDependencyCount, 4);
  assert.strictEqual(metrics.throttlingBudget, 3);
  assert.strictEqual(metrics.throttlingRemaining, 2);
  assert.strictEqual(metrics.throttlingInterval, 1000);
  assert.strictEqual(metrics.resourceCapabilityError, 1);
});

test("captures timeout telemetry when worker feature report exceeds budget", () => {
  resetWorkerTelemetry({ bufferLimit: 4, version: 1 });

  recordWorkerFeatureReportEvent({
    requestId: 9,
    status: "timeout",
    errors: [{ message: "timeout", code: "feature-report-timeout" }],
    roundTripMs: 120,
    detectionStatus: "timeout",
    timeoutCount: 1,
    workerErrors: 0
  });

  const state = getWorkerTelemetryChannelState();
  assert.ok(state);
  assert.strictEqual(state.history.length, 1);

  const payload = state.history[0].payload;
  assert.strictEqual(payload.status, "timeout");
  assert.deepStrictEqual(payload.errors, [{ message: "timeout", code: "feature-report-timeout" }]);
  assert.strictEqual(payload.metrics.roundTripMs, 120);
  assert.strictEqual(payload.metrics.timeoutCount, 1);
  assert.strictEqual(payload.metrics.workerErrors, 0);
  assert.deepStrictEqual(payload.detection, { status: "timeout" });
});

test("configureWorkerTelemetry applies channel configuration", () => {
  resetWorkerTelemetry({ bufferLimit: 3, version: 1 });
  const channel = configureWorkerTelemetry({ bufferLimit: 12, version: 5 });
  assert.ok(channel);
  assert.strictEqual(channel.bufferLimit, 12);
  assert.strictEqual(channel.version, 5);

  const state = getWorkerTelemetryChannelState();
  assert.ok(state);
  assert.strictEqual(state.bufferLimit, 12);
  assert.strictEqual(state.version, 5);
});
