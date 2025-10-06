"use strict";

import assert from "assert";
import fs from "fs/promises";
import vm from "vm";

function createFakeCache() {
    const store = new Map();
    function getUrl(request) {
        if (!request) return undefined;
        if (typeof request === "string") return request;
        if (request.url) return request.url;
        return String(request);
    }
    return {
        name: null,
        async put(request, response) {
            const url = getUrl(request);
            const cloned = await cloneResponse(response);
            store.set(url, cloned);
        },
        async match(request) {
            const url = getUrl(request);
            if (!store.has(url)) return undefined;
            const entry = store.get(url);
            return new Response(entry.buffer.slice(0), { headers: entry.headers });
        },
        async delete(request) {
            const url = getUrl(request);
            store.delete(url);
        },
        async keys() {
            return Array.from(store.keys()).map((url) => new Request(url));
        },
    };
}

async function cloneResponse(response) {
    const buffer = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    return { buffer, headers };
}

function createFakeCaches() {
    const caches = new Map();
    return {
        async open(name) {
            if (!caches.has(name)) {
                const cache = createFakeCache();
                cache.name = name;
                caches.set(name, cache);
            }
            return caches.get(name);
        },
    };
}

async function loadServiceWorker(fakeCaches, clientListeners) {
    const handlers = {};
    const swGlobal = {
        caches: fakeCaches,
        clients: {
            matchAll: async () => [{
                postMessage(payload) {
                    clientListeners.forEach((listener) => {
                        try { listener({ data: payload }); } catch (_) {}
                    });
                },
            }],
            claim: () => Promise.resolve(),
        },
        skipWaiting: () => Promise.resolve(),
        addEventListener: (type, handler) => {
            handlers[type] = handler;
        },
    };
    const context = {
        self: swGlobal,
        caches: fakeCaches,
        Response,
        Request,
        Headers,
        ArrayBuffer,
        Uint8Array,
        console,
    };
    const source = await fs.readFile(new URL("../../run/squeak-storage-sw.js", import.meta.url), "utf8");
    vm.runInNewContext(source, context, { filename: "squeak-storage-sw.js" });
    return {
        dispatchMessage(message) {
            const handler = handlers.message;
            if (!handler) return Promise.resolve();
            const waiters = [];
            handler({
                data: message,
                waitUntil(promise) { if (promise) waiters.push(promise); },
            });
            return Promise.all(waiters);
        },
    };
}

async function runStorageQuotaTest() {
    const fakeCaches = createFakeCaches();
    const clientListeners = [];
    const serviceWorkerContext = await loadServiceWorker(fakeCaches, clientListeners);
    const pendingMessages = [];
    const fakeController = {
        postMessage(message) {
            const cloned = Object.assign({}, message);
            pendingMessages.push(serviceWorkerContext.dispatchMessage(cloned));
        },
    };
    const serviceWorkerRegistration = { scope: "./", active: fakeController };
    const messageListeners = clientListeners;
    const serviceWorker = {
        controller: fakeController,
        register: async () => serviceWorkerRegistration,
        ready: Promise.resolve(serviceWorkerRegistration),
        addEventListener: (type, handler) => {
            if (type === "message") messageListeners.push(handler);
        },
    };
    const quotas = { usage: 0, quota: 1024 * 1024 };
    const signaled = [];
    global.navigator = {
        serviceWorker,
        storage: {
            estimate: async () => ({ usage: quotas.usage, quota: quotas.quota }),
        },
    };
    global.caches = fakeCaches;
    global.Squeak = {
        StorageVFS: {},
        StorageQuota: {},
        vm: {
            primHandler: {
                signalSemaphoreWithIndex(index) {
                    signaled.push(index);
                },
            },
        },
    };
    global.Squeak.Settings = {};

    const vfsModule = await import(new URL("../../vm.storage.vfs.js", import.meta.url).href);
    const quotaModule = await import(new URL("../../vm.storage.quota.js", import.meta.url).href);

    const {
        ensureStorageVFSRegistration,
        notifyStorageWrite,
    } = vfsModule;
    const {
        ensureStorageQuotaMonitor,
        forceStorageQuotaSample,
        drainStorageQuotaEvents,
        setStorageQuotaWarningSemaphore,
        getStorageQuotaState,
    } = quotaModule;

    await ensureStorageVFSRegistration({ autoReplay: false });

    ensureStorageQuotaMonitor({
        thresholds: { notice: 0.3, warning: 0.6, critical: 0.8 },
        pollInterval: 0,
        autoSample: false,
        immediate: false,
    });

    notifyStorageWrite("project.image", new Uint8Array([1, 2, 3, 4]).buffer, { size: 4, updatedAt: 1111 });
    notifyStorageWrite("temp.log", new Uint8Array([5, 6, 7, 8, 9]).buffer, { size: 5, updatedAt: 2222 });

    await Promise.all(pendingMessages.splice(0));

    quotas.usage = 900000;
    quotas.quota = 1000000;

    setStorageQuotaWarningSemaphore(7);

    const sample = await forceStorageQuotaSample();
    await Promise.all(pendingMessages.splice(0));

    assert.ok(sample.percentUsed >= 0.9);

    const events = drainStorageQuotaEvents();
    const levels = events.filter((event) => event.type === "threshold").map((event) => event.level);
    assert.ok(levels.includes("notice"));
    assert.ok(levels.includes("warning"));
    assert.ok(levels.includes("critical"));

    const evictionRequest = events.find((event) => event.type === "eviction-request");
    assert.ok(evictionRequest, "expected eviction request event");
    assert.ok(Array.isArray(evictionRequest.paths) && evictionRequest.paths.includes("temp.log"));

    const evictionResult = events.find((event) => event.type === "eviction-result");
    assert.ok(evictionResult, "expected eviction result event");
    assert.ok(evictionResult.result && Array.isArray(evictionResult.result.paths));
    assert.ok(evictionResult.result.paths.includes("temp.log"));

    assert.strictEqual(signaled.includes(7), true);

    const cache = await fakeCaches.open("squeak-vfs-cache");
    const keys = await cache.keys();
    assert.strictEqual(keys.some((request) => request.url.includes("temp.log")), false);
    assert.strictEqual(keys.some((request) => request.url.includes("project.image")), true);

    const state = getStorageQuotaState();
    assert.ok(state.history.length >= 1);
    assert.ok(state.lastEviction);
}

await runStorageQuotaTest();

