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
        _entries() {
            return new Map(store);
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

async function loadServiceWorker(fakeCaches) {
    const handlers = {};
    const swGlobal = {
        caches: fakeCaches,
        clients: {
            matchAll: async () => [],
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

async function runStorageVFSTest() {
    const fakeCaches = createFakeCaches();
    const serviceWorkerContext = await loadServiceWorker(fakeCaches);
    const pendingMessages = [];
    const fakeController = {
        postMessage(message) {
            const cloned = Object.assign({}, message);
            pendingMessages.push(serviceWorkerContext.dispatchMessage(cloned));
        },
    };
    const serviceWorkerRegistration = { scope: "./", active: fakeController };
    const serviceWorker = {
        controller: fakeController,
        register: async () => serviceWorkerRegistration,
        ready: Promise.resolve(serviceWorkerRegistration),
        addEventListener: () => {},
    };
    global.navigator = { serviceWorker };
    global.caches = fakeCaches;
    const writes = [];
    global.Squeak = {
        StorageVFS: {},
        filePut(path, contents) {
            const size = contents instanceof ArrayBuffer
                ? contents.byteLength
                : ArrayBuffer.isView(contents)
                    ? contents.byteLength
                    : 0;
            writes.push({ path, size });
        },
    };
    const moduleUrl = new URL("../../vm.storage.vfs.js", import.meta.url).href;
    const {
        ensureStorageVFSRegistration,
        notifyStorageWrite,
        notifyStorageDelete,
        notifyStorageRename,
        replayStorageFromCache,
        getStorageVFSState,
    } = await import(moduleUrl);

    await ensureStorageVFSRegistration({ autoReplay: false });
    const stateAfterRegistration = getStorageVFSState();
    assert.strictEqual(stateAfterRegistration.supported, true);

    notifyStorageWrite("project.changes", new Uint8Array([1, 2, 3, 4]).buffer, { size: 4, updatedAt: 1111 });
    await Promise.all(pendingMessages.splice(0));

    const cache = await fakeCaches.open("squeak-vfs-cache");
    const writeKeys = await cache.keys();
    assert.ok(writeKeys.some((request) => request.url.includes("project.changes")));

    notifyStorageRename("project.changes", "project-new.changes", {
        contents: new Uint8Array([9, 9]).buffer,
        size: 2,
        updatedAt: 2222,
    });
    await Promise.all(pendingMessages.splice(0));
    const renameKeys = await cache.keys();
    assert.ok(renameKeys.some((request) => request.url.includes("project-new.changes")));

    notifyStorageDelete("project-new.changes", { updatedAt: 3333 });
    await Promise.all(pendingMessages.splice(0));
    const deleteKeys = await cache.keys();
    assert.strictEqual(deleteKeys.some((request) => request.url.includes("project-new.changes")), false);

    // Rehydrate via replay
    notifyStorageWrite("persistent.log", new Uint8Array([7, 7, 7]).buffer, { size: 3, updatedAt: 4444 });
    await Promise.all(pendingMessages.splice(0));
    const replayResult = await replayStorageFromCache();
    assert.strictEqual(replayResult.restored >= 1, true);
    assert.strictEqual(writes.some((entry) => entry.path === "persistent.log"), true);

    const finalState = getStorageVFSState();
    assert.strictEqual(finalState.pending, 0);
    assert.ok(finalState.lastOperationAt || finalState.sequence > 0);
}

await runStorageVFSTest();
