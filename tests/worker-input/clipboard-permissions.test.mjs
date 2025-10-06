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
}

class FakePermissionStatus {
    constructor(state) {
        this.state = state;
    }

    addEventListener() {}
}

function createDeniedNavigator() {
    return {
        clipboard: {
            readText: () => Promise.reject(new Error("Permission denied")),
            writeText: () => Promise.reject(new Error("Permission denied")),
        },
        permissions: {
            query: ({ name }) => {
                if (name === "clipboard-read" || name === "clipboard-write") {
                    return Promise.resolve(new FakePermissionStatus("denied"));
                }
                return Promise.resolve(new FakePermissionStatus("granted"));
            },
        },
    };
}

function lastMessage(worker) {
    if (!worker.messages.length) return null;
    return worker.messages[worker.messages.length - 1];
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function runDeniedScenario() {
    const originalNavigator = global.navigator;
    global.navigator = createDeniedNavigator();

    const controller = new WorkerVMController();
    const fakeWorker = new FakeWorker();
    controller.worker = fakeWorker;

    controller.setClipboardText("cached");
    controller._handleMessage({ type: "clipboard-read-request", requestId: 7 });
    await tick();
    const readResponse = lastMessage(fakeWorker);
    assert.strictEqual(readResponse.type, "clipboard-read-response");
    assert.strictEqual(readResponse.permission, "denied");
    assert.strictEqual(readResponse.text, "cached");
    assert.strictEqual(readResponse.fromCache, true);
    assert.ok(readResponse.error);
    assert.strictEqual(readResponse.error.name, "ClipboardPermissionDenied");
    assert.strictEqual(controller._clipboardState.lastStatus.type, "permission-denied");

    controller._handleMessage({ type: "clipboard-write-request", requestId: 8, text: "outbound" });
    await tick();
    const writeResponse = lastMessage(fakeWorker);
    assert.strictEqual(writeResponse.type, "clipboard-write-response");
    assert.strictEqual(writeResponse.permission, "denied");
    assert.strictEqual(writeResponse.text, "outbound");
    assert.strictEqual(writeResponse.fromCache, true);
    assert.ok(writeResponse.error);
    assert.strictEqual(writeResponse.error.name, "ClipboardPermissionDenied");
    assert.strictEqual(controller._clipboardState.text, "outbound");

    const diagnostics = controller.getClipboardDiagnostics();
    assert.strictEqual(diagnostics.permissions.read, "denied");
    assert.strictEqual(diagnostics.permissions.write, "denied");
    assert.ok(diagnostics.errorCounts.ClipboardPermissionDenied >= 2);

    if (originalNavigator === undefined) delete global.navigator;
    else global.navigator = originalNavigator;
}

await runDeniedScenario();
