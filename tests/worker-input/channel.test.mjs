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

function lastMessage(worker) {
    if (!worker.messages.length) return null;
    return worker.messages[worker.messages.length - 1];
}

function run() {
    const controller = new WorkerVMController();
    const fakeWorker = new FakeWorker();
    controller.worker = fakeWorker;

    controller.sendInputEvent([1, 2, 3]);
    assert.deepStrictEqual(lastMessage(fakeWorker), { type: "input-event", event: [1, 2, 3] });

    controller.sendInputEvents([[7], [8]]);
    assert.deepStrictEqual(lastMessage(fakeWorker), { type: "input-events", events: [[7], [8]] });

    controller.setClipboardText("hello");
    assert.strictEqual(controller._clipboardState.text, "hello");

    controller._handleMessage({ type: "clipboard-read-request", requestId: 42 });
    assert.deepStrictEqual(lastMessage(fakeWorker), { type: "clipboard-read-response", requestId: 42, text: "hello" });

    controller._handleMessage({ type: "clipboard-write-request", requestId: 43, text: "world" });
    assert.deepStrictEqual(lastMessage(fakeWorker), { type: "clipboard-write-response", requestId: 43, text: "world" });
    assert.strictEqual(controller._clipboardState.text, "world");

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

    return reportPromise.then((payload) => {
        assert.ok(payload.report);
        assert.strictEqual(controller.lastFeatureReport, payload.report);
        controller.terminate();
        assert.strictEqual(fakeWorker.terminated, true);
    });
}

await run();
