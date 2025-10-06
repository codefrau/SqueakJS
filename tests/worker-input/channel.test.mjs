"use strict";

import assert from "assert";
import { WorkerVMController } from "../../vm.worker.host.js";

class FakeWorker {
    constructor() {
        this.messages = [];
    }

    postMessage(payload) {
        this.messages.push(payload);
    }

    terminate() {
        this.terminated = true;
    }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function lastMessage(worker) {
    if (!worker.messages.length) return null;
    return worker.messages[worker.messages.length - 1];
}

async function run() {
    const controller = new WorkerVMController();
    const fakeWorker = new FakeWorker();
    controller.worker = fakeWorker;

    controller.sendInputEvent([1, 2, 3]);
    assert.deepStrictEqual(lastMessage(fakeWorker), { type: "input-event", event: [1, 2, 3] });

    controller.sendInputEvents([[7], [8]]);
    assert.deepStrictEqual(lastMessage(fakeWorker), { type: "input-events", events: [[7], [8]] });

    controller.setClipboardText("hello");
    assert.strictEqual(controller._clipboardState.text, "hello");
    const clipboardSeed = lastMessage(fakeWorker);
    assert.strictEqual(clipboardSeed.type, "clipboard-set");
    assert.strictEqual(typeof clipboardSeed.timestamp, "number");
    fakeWorker.messages.length = 0;

    controller._handleMessage({ type: "clipboard-read-request", requestId: 42 });
    await tick();
    const readResponse = lastMessage(fakeWorker);
    assert.strictEqual(readResponse.type, "clipboard-read-response");
    assert.strictEqual(readResponse.requestId, 42);
    assert.strictEqual(readResponse.text, "hello");
    assert.strictEqual(readResponse.fromCache, true);
    assert.strictEqual(typeof readResponse.cachedAt, "number");

    controller._handleMessage({ type: "clipboard-write-request", requestId: 43, text: "world" });
    await tick();
    const writeResponse = lastMessage(fakeWorker);
    assert.strictEqual(writeResponse.type, "clipboard-write-response");
    assert.strictEqual(writeResponse.requestId, 43);
    assert.strictEqual(writeResponse.text, "world");
    assert.strictEqual(writeResponse.fromCache, true);
    assert.strictEqual(controller._clipboardState.text, "world");

    const diagnostics = controller.getClipboardDiagnostics();
    assert.strictEqual(diagnostics.text, "world");
    assert.strictEqual(typeof diagnostics.cachedAt, "number");
    assert.strictEqual(diagnostics.queuePending, 0);

    const reportPromise = controller.requestFeatureReport();
    const reportRequest = lastMessage(fakeWorker);
    assert.strictEqual(reportRequest.type, "feature-report-request");
    assert.strictEqual(typeof reportRequest.requestId, "number");

    controller._handleMessage({
        type: "feature-report",
        requestId: reportRequest.requestId,
        report: {
            display: { supported: [], missing: [] },
            audio: { output: { fallback: true }, input: { fallback: true } },
            file: { missingOperations: [] },
            mainThreadDependencies: [],
        },
    });

    const payload = await reportPromise;
    assert.ok(payload.report);
    assert.ok(payload.report.resourceCapabilities);
    assert.equal(payload.report.resourceCapabilities.version, 1);
    assert.strictEqual(controller.lastFeatureReport, payload.report);
    controller.terminate();
    assert.strictEqual(fakeWorker.terminated, true);
}

await run();
