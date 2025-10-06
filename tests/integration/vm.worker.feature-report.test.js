import test from "node:test";
import assert from "node:assert/strict";
import { WorkerVMController } from "../../vm.worker.host.js";

const detectionBehavior = {
  mode: "resolve",
  delayMs: 0,
  payload: { version: 1, resources: {} },
  error: new Error("resource-detection-error"),
  errorCode: "resource-detection-error"
};

function configureDetection(options = {}) {
  detectionBehavior.mode = options.mode ?? "resolve";
  detectionBehavior.delayMs = options.delayMs ?? 0;
  detectionBehavior.payload = options.payload ?? { version: 1, resources: {} };
  detectionBehavior.error = options.error ?? new Error("resource-detection-error");
  detectionBehavior.errorCode = options.errorCode ?? "resource-detection-error";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createController() {
  return new WorkerVMController({
    ensureResourceCapabilityReport: async () => {
      if (detectionBehavior.delayMs > 0) {
        await delay(detectionBehavior.delayMs);
      }
      if (detectionBehavior.mode === "reject") {
        throw detectionBehavior.error;
      }
      return detectionBehavior.payload;
    },
    formatResourceCapabilityError: (error) => ({
      message: error && error.message ? error.message : String(error),
      code: detectionBehavior.errorCode
    })
  });
}

class FakeWorker {
  constructor() {
    this.messages = [];
    this.terminated = false;
  }

  postMessage(payload) {
    this.messages.push(payload);
  }

  terminate() {
    this.terminated = true;
  }
}

function lastMessage(worker) {
  if (!worker.messages.length) return null;
  return worker.messages[worker.messages.length - 1];
}

test("merges local resource capabilities into feature reports after throttled detection", async () => {
  configureDetection({
    mode: "resolve",
    delayMs: 25,
    payload: {
      version: 3,
      resources: {
        clipboard: { supported: true, permission: "granted" }
      }
    }
  });

  const controller = createController();
  const worker = new FakeWorker();
  controller.worker = worker;

  const reportPromise = controller.requestFeatureReport({ timeout: 200 });
  const request = lastMessage(worker);
  assert.ok(request, "worker did not receive feature report request");
  assert.strictEqual(request.type, "feature-report-request");

  controller._handleMessage({
    type: "feature-report",
    requestId: request.requestId,
    report: {
      mainThreadDependencies: ["display"],
      throttling: { budget: 4 }
    }
  });

  const payload = await reportPromise;
  assert.ok(payload.report);
  assert.deepStrictEqual(payload.report.resourceCapabilities, detectionBehavior.payload);
  assert.deepStrictEqual(payload.report.throttling, { budget: 4 });
  assert.strictEqual(controller.lastFeatureReport, payload.report);
});

test("rejects feature report requests that exceed the configured timeout", async () => {
  configureDetection({ mode: "resolve", delayMs: 0 });

  const controller = createController();
  const worker = new FakeWorker();
  controller.worker = worker;

  await assert.rejects(
    controller.requestFeatureReport({ timeout: 15 }),
    /timed out/
  );
  assert.strictEqual(controller._pendingReports.size, 0);
});

test("annotates worker feature reports when local capability detection fails", async () => {
  const detectionError = Object.assign(new Error("permission denied"), { code: "denied" });
  configureDetection({
    mode: "reject",
    error: detectionError,
    errorCode: "resource-capability-detection-denied"
  });

  const controller = createController();
  const worker = new FakeWorker();
  controller.worker = worker;

  const reportPromise = controller.requestFeatureReport({ timeout: 200 });
  const request = lastMessage(worker);
  assert.ok(request, "worker did not receive feature report request");

  controller._handleMessage({
    type: "feature-report",
    requestId: request.requestId,
    report: {
      audio: { input: { supported: false } }
    },
    errors: [{ message: "worker-audio-error" }]
  });

  const payload = await reportPromise;
  assert.ok(Array.isArray(payload.errors));
  assert.strictEqual(payload.errors.length, 2);
  assert.deepStrictEqual(payload.errors[1], {
    message: "permission denied",
    code: "resource-capability-detection-denied"
  });
  assert.deepStrictEqual(payload.resourceCapabilityError, {
    message: "permission denied",
    code: "resource-capability-detection-denied"
  });
  assert.ok(payload.report);
  assert.strictEqual(controller.lastFeatureReport, payload.report);
});
