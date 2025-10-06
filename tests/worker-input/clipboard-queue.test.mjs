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

function setupNavigator(log) {
    let readCount = 0;
    let writeCount = 0;
    const readResolvers = [];
    const writeResolvers = [];
    const navigatorStub = {
        clipboard: {
            readText: () => {
                const index = ++readCount;
                log.push({ type: "read-start", index });
                return new Promise((resolve) => {
                    readResolvers.push(() => {
                        log.push({ type: "read-resolve", index });
                        resolve("value-" + index);
                    });
                });
            },
            writeText: (text) => {
                const index = ++writeCount;
                log.push({ type: "write-start", text, index });
                return new Promise((resolve) => {
                    writeResolvers.push(() => {
                        log.push({ type: "write-resolve", text, index });
                        resolve();
                    });
                });
            },
        },
        permissions: {
            query: ({ name }) => {
                if (name === "clipboard-read" || name === "clipboard-write") {
                    return Promise.resolve(new FakePermissionStatus("granted"));
                }
                return Promise.resolve(new FakePermissionStatus("granted"));
            },
        },
    };
    return { navigator: navigatorStub, readResolvers, writeResolvers, log };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function runQueueScenario() {
    const log = [];
    const { navigator, readResolvers, writeResolvers } = setupNavigator(log);
    const originalNavigator = global.navigator;
    try {
        global.navigator = navigator;

        const controller = new WorkerVMController();
        const fakeWorker = new FakeWorker();
        controller.worker = fakeWorker;

        controller._handleMessage({ type: "clipboard-read-request", requestId: 1 });
        await tick();
        assert.strictEqual(readResolvers.length, 1, "first read should start after scheduling");

        controller._handleMessage({ type: "clipboard-read-request", requestId: 2 });
        await tick();
        assert.strictEqual(readResolvers.length, 1, "second read should wait until first completes");

        readResolvers.shift()();
        await tick();
        assert.strictEqual(readResolvers.length, 1, "second read should start after first resolves");

        readResolvers.shift()();
        await tick();

        assert.strictEqual(fakeWorker.messages.length, 2);
        assert.strictEqual(fakeWorker.messages[0].requestId, 1);
        assert.strictEqual(fakeWorker.messages[0].text, "value-1");
        assert.strictEqual(fakeWorker.messages[1].requestId, 2);
        assert.strictEqual(fakeWorker.messages[1].text, "value-2");

        fakeWorker.messages.length = 0;

        controller._handleMessage({ type: "clipboard-write-request", requestId: 3, text: "alpha" });
        await tick();
        assert.strictEqual(writeResolvers.length, 1, "first write should start after scheduling");

        controller._handleMessage({ type: "clipboard-write-request", requestId: 4, text: "beta" });
        await tick();
        assert.strictEqual(writeResolvers.length, 1, "second write should queue behind first");

        writeResolvers.shift()();
        await tick();
        assert.strictEqual(writeResolvers.length, 1, "second write should start after first resolves");

        writeResolvers.shift()();
        await tick();

        assert.strictEqual(fakeWorker.messages.length, 2);
        assert.strictEqual(fakeWorker.messages[0].requestId, 3);
        assert.strictEqual(fakeWorker.messages[0].text, "alpha");
        assert.strictEqual(fakeWorker.messages[1].requestId, 4);
        assert.strictEqual(fakeWorker.messages[1].text, "beta");

        const queueState = controller._clipboardQueue.getState();
        assert.strictEqual(queueState.pending, 0);
    } finally {
        if (originalNavigator === undefined) delete global.navigator;
        else global.navigator = originalNavigator;
    }
}

await runQueueScenario();
