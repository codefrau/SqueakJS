import test from "node:test";
import assert from "node:assert/strict";

import { WorkerVMController } from "../../vm.worker.host.js";
import {
  getWorkerTelemetryChannelState,
  resetWorkerTelemetry
} from "../../vm.worker.telemetry.js";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ScriptedWorker {
  constructor(controller, steps) {
    this.controller = controller;
    this.steps = Array.isArray(steps) ? steps.slice() : [];
    this.messages = [];
    this.terminated = false;
  }

  postMessage(payload) {
    this.messages.push(payload);
    if (payload && payload.type === "feature-report-request") {
      const index = this.messages.filter((msg) => msg.type === "feature-report-request").length - 1;
      const plan = this.steps[index % this.steps.length] || {};
      const delayMs = Number.isFinite(plan.delayMs) ? plan.delayMs : 0;
      setTimeout(() => {
        if (this.terminated) return;
        const response = {
          type: "feature-report",
          requestId: payload.requestId,
          report: Object.assign({}, plan.report || {})
        };
        if (!response.report.mainThreadDependencies && Array.isArray(plan.mainThreadDependencies)) {
          response.report.mainThreadDependencies = plan.mainThreadDependencies.slice();
        }
        if (plan.throttling) {
          response.report.throttling = Object.assign({}, plan.throttling);
        }
        if (Array.isArray(plan.workerErrors) && plan.workerErrors.length > 0) {
          response.errors = plan.workerErrors.map((error) => ({
            message: error.message,
            code: error.code
          }));
        }
        this.controller._handleMessage(response);
      }, delayMs);
    }
  }

  terminate() {
    this.terminated = true;
  }
}

function createDetectionScenario(entries) {
  let index = 0;
  const sequence = Array.isArray(entries) ? entries.slice() : [];
  return {
    ensure: async () => {
      const entry = sequence[index % sequence.length] || {};
      index += 1;
      if (Number.isFinite(entry.delayMs) && entry.delayMs > 0) {
        await delay(entry.delayMs);
      }
      if (entry.error) {
        const error = entry.error instanceof Error
          ? entry.error
          : Object.assign(new Error(entry.error.message || "resource capability error"), {
              code: entry.error.code || "resource-capability-error"
            });
        throw error;
      }
      return entry.payload || { version: 1, resources: {} };
    },
    format: (error) => ({
      message: error && error.message ? error.message : String(error),
      code: error && error.code ? error.code : "resource-capability-detection-error"
    })
  };
}

const STRESS_PLAN = [
  {
    delayMs: 8,
    throttling: { budget: 5, remaining: 4, state: "healthy" },
    mainThreadDependencies: ["display"]
  },
  {
    delayMs: 15,
    throttling: { budget: 1, remaining: 0, state: "throttled", cooldownMs: 120 },
    workerErrors: [{ message: "permission denied", code: "worker-audio-denied" }],
    mainThreadDependencies: ["audio", "clipboard"]
  },
  {
    delayMs: 4,
    report: { mainThreadDependencies: ["display"] }
  },
  {
    delayMs: 6,
    throttling: { budget: 2, remaining: 1, state: "recovering", latencyMs: 18 },
    workerErrors: []
  },
  {
    delayMs: 2,
    report: { mainThreadDependencies: ["clipboard"] }
  },
  {
    delayMs: 10,
    throttling: { budget: 3, remaining: 2, state: "healthy", reason: "resume" }
  },
  {
    delayMs: 5,
    throttling: { budget: 2, remaining: 0, state: "throttled", cooldownMs: 90 },
    workerErrors: [{ message: "capability denied", code: "worker-clipboard-denied" }]
  },
  {
    delayMs: 1,
    report: { mainThreadDependencies: [] }
  },
  {
    delayMs: 7,
    throttling: { budget: 4, remaining: 3, state: "healthy", resets: 1 }
  },
  {
    delayMs: 3,
    throttling: { budget: 1, remaining: 0, state: "throttled", reason: "cooldown" }
  },
  {
    delayMs: 6,
    report: { mainThreadDependencies: ["display", "power"] }
  },
  {
    delayMs: 2,
    throttling: { budget: 5, remaining: 5, state: "healthy" }
  }
];

const DETECTION_SEQUENCE = [
  { delayMs: 6, payload: { version: 3, resources: { clipboard: { supported: true } } } },
  { delayMs: 2, payload: { version: 3, resources: { audio: { supported: false } } } },
  { delayMs: 12, error: { message: "detection throttled", code: "resource-detection-throttled" } },
  { delayMs: 4, payload: { version: 3, resources: { clipboard: { supported: false } } } },
  { delayMs: 1, payload: { version: 4, resources: { display: { supported: true } } } },
  { delayMs: 9, error: { message: "permission denied", code: "resource-detection-denied" } },
  { delayMs: 3, payload: { version: 4, resources: { power: { supported: true } } } },
  { delayMs: 2, payload: { version: 4, resources: { fullscreen: { supported: true } } } },
  { delayMs: 7, payload: { version: 4, resources: { storage: { supported: true } } } },
  { delayMs: 5, error: { message: "transient failure", code: "resource-detection-transient" } },
  { delayMs: 3, payload: { version: 4, resources: { display: { supported: true } } } },
  { delayMs: 1, payload: { version: 4, resources: { clipboard: { supported: true } } } }
];

test("worker controller recovers from throttled and denied feature reports under stress", async () => {
  const detection = createDetectionScenario(DETECTION_SEQUENCE);
  resetWorkerTelemetry({ bufferLimit: 128, version: 1 });

  const controller = new WorkerVMController({
    ensureResourceCapabilityReport: detection.ensure,
    formatResourceCapabilityError: detection.format
  });
  const worker = new ScriptedWorker(controller, STRESS_PLAN);
  controller.worker = worker;

  const pending = STRESS_PLAN.map(() => controller.requestFeatureReport({ timeout: 250 }));
  const results = await Promise.allSettled(pending);

  assert.ok(results.every((result) => result.status === "fulfilled"), "expected all stress requests to resolve");
  const reports = results.map((result) => result.value);
  assert.strictEqual(controller._pendingReports.size, 0);
  assert.ok(controller.lastFeatureReport);
  const matched = reports.some((payload) => {
    try {
      assert.deepStrictEqual(payload.report, controller.lastFeatureReport);
      return true;
    } catch (_) {
      return false;
    }
  });
  assert.ok(matched, "last feature report should match one of the stress responses");

  const telemetry = getWorkerTelemetryChannelState();
  assert.ok(telemetry, "telemetry channel should be initialized");
  assert.ok(telemetry.history.length >= STRESS_PLAN.length, "expected telemetry events for each stress iteration");

  const recentEvents = telemetry.history.slice(-STRESS_PLAN.length);
  const degradedEvents = recentEvents.filter((event) => event.payload && event.payload.status === "degraded");
  assert.ok(degradedEvents.length >= 3, "expected degraded events for detection failures and worker denials");

  const throttleSamples = recentEvents
    .map((event) => event.payload && event.payload.metrics && event.payload.metrics.throttlingBudget)
    .filter((value) => Number.isFinite(value));
  assert.ok(throttleSamples.length >= 6, "expected throttling metrics to be captured");

  const capabilityFailures = recentEvents
    .map((event) => event.payload && event.payload.metrics && event.payload.metrics.resourceCapabilityError)
    .filter((value) => value === 1);
  assert.ok(capabilityFailures.length >= 3, "expected resource capability errors to be recorded");

  const detectionDurations = recentEvents
    .map((event) => event.payload && event.payload.metrics && event.payload.metrics.detectionDurationMs)
    .filter((value) => Number.isFinite(value));
  assert.ok(detectionDurations.length >= STRESS_PLAN.length - 1);
  assert.ok(detectionDurations.every((value) => value >= 0));
});
