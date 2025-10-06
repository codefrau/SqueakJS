import test from "node:test";
import assert from "node:assert/strict";

import { WorkerVMController } from "../../vm.worker.host.js";

function createRespondingWorker(controller, responseFactory) {
  return {
    postMessage(message) {
      if (!message || message.type !== "feature-report-request") {
        return;
      }
      const response = typeof responseFactory === "function"
        ? responseFactory(message)
        : {};
      setImmediate(() => {
        controller._handleMessage(Object.assign({
          type: "feature-report",
          requestId: message.requestId,
          report: {
            mainThreadDependencies: [],
            throttling: null
          }
        }, response));
      });
    },
    terminate() {}
  };
}

test("WorkerVMController telemetry injection merges defaults and overrides", async () => {
  const events = [];
  const controller = new WorkerVMController({
    telemetry: {
      context: { runtime: "unit" },
      tags: ["baseline"],
      record: (detail) => events.push(detail)
    },
    ensureResourceCapabilityReport: async () => ({ version: 1, resources: {} })
  });

  controller.worker = createRespondingWorker(controller, () => ({
    report: {
      mainThreadDependencies: ["display"],
      throttling: { budget: 3, remaining: 2 }
    },
    errors: [{ message: "permission denied", code: "worker-denied" }]
  }));

  const payload = await controller.requestFeatureReport({ timeout: 100 });
  assert.ok(payload);
  assert.strictEqual(events.length, 1);
  const event = events[0];
  assert.strictEqual(event.status, "degraded");
  assert.deepStrictEqual(event.context, { runtime: "unit" });
  assert.deepStrictEqual(event.tags, ["baseline"]);
  assert.strictEqual(event.workerErrors, 1);
  assert.strictEqual(event.mainThreadDependencyCount, 1);
  assert.ok(Number.isFinite(event.roundTripMs));
});

test("request-level telemetry overrides emit without global handlers", async () => {
  const controller = new WorkerVMController({
    telemetry: false,
    ensureResourceCapabilityReport: async () => ({ version: 1, resources: {} })
  });

  controller.worker = createRespondingWorker(controller, () => ({
    report: {
      mainThreadDependencies: ["clipboard"],
      throttling: { budget: 2, remaining: 1 }
    }
  }));

  const overrideEvents = [];
  const payload = await controller.requestFeatureReport({
    timeout: 100,
    telemetry: {
      context: { request: "override" },
      tags: ["per-request"],
      record: (detail) => overrideEvents.push(detail)
    }
  });
  assert.ok(payload);
  assert.strictEqual(overrideEvents.length, 1);
  assert.deepStrictEqual(overrideEvents[0].context, { request: "override" });
  assert.deepStrictEqual(overrideEvents[0].tags, ["per-request"]);
  assert.strictEqual(overrideEvents[0].status, "ok");
});

test("timeout telemetry respects per-request overrides", async () => {
  const overrideEvents = [];
  const controller = new WorkerVMController({
    telemetry: false,
    ensureResourceCapabilityReport: async () => ({ version: 1, resources: {} })
  });

  controller.worker = {
    postMessage() {},
    terminate() {}
  };

  await assert.rejects(
    controller.requestFeatureReport({
      timeout: 15,
      telemetry: {
        context: { request: "timeout" },
        record: (detail) => overrideEvents.push(detail)
      }
    }),
    /timed out/
  );

  assert.strictEqual(overrideEvents.length, 1);
  assert.strictEqual(overrideEvents[0].status, "timeout");
  assert.deepStrictEqual(overrideEvents[0].context, { request: "timeout" });
  assert.ok(Number.isFinite(overrideEvents[0].roundTripMs));
});

test("abort signal cancels feature report requests and emits telemetry", async () => {
  const events = [];
  const controller = new WorkerVMController({
    telemetry: {
      record: (detail) => events.push(detail)
    },
    ensureResourceCapabilityReport: async () => ({ version: 1, resources: {} })
  });

  const postMessages = [];
  controller.worker = {
    postMessage(payload) {
      postMessages.push(payload);
    },
    terminate() {}
  };

  const abortController = new AbortController();
  const requestPromise = controller.requestFeatureReport({
    timeout: 250,
    signal: abortController.signal
  });

  abortController.abort(new Error("stop feature report"));

  await assert.rejects(requestPromise, (error) => {
    assert.ok(error instanceof Error);
    assert.strictEqual(error.message, "stop feature report");
    assert.strictEqual(error.name, "AbortError");
    return true;
  });

  assert.ok(postMessages.length === 0 || postMessages.length === 1);
  assert.strictEqual(events.length, 1);
  const event = events[0];
  assert.strictEqual(event.status, "aborted");
  assert.strictEqual(event.detectionStatus, "cancelled");
  assert.ok(Number.isFinite(event.roundTripMs));
  assert.ok(Number.isFinite(event.detectionDurationMs));
  assert.ok(Array.isArray(event.errors));
  assert.strictEqual(event.errors.length, 1);
  assert.strictEqual(event.errors[0].code, "feature-report-aborted");
  assert.strictEqual(event.errors[0].message, "stop feature report");
  assert.strictEqual(event.workerErrors, 0);
});
