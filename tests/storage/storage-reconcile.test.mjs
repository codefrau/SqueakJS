"use strict";

import assert from "assert";

import {
    forceStorageReconciliation,
    scheduleStorageReconciliation,
    getStorageReconciliationState,
    __resetStorageReconcilerForTests,
    stopStorageReconciler,
} from "../../vm.storage.reconcile.js";

const VFS_URL_PREFIX = "https://squeak.invalid/vfs/";
const MANIFEST_URL = VFS_URL_PREFIX + "__manifest__";

function createFakeCache() {
    const store = new Map();
    function getUrl(request) {
        if (!request) return undefined;
        if (typeof request === "string") return request;
        if (request.url) return request.url;
        return String(request);
    }
    return {
        async put(request, response) {
            const url = getUrl(request);
            const cloned = await cloneResponse(response);
            store.set(url, cloned);
        },
        async match(request) {
            const url = getUrl(request);
            if (!store.has(url)) return undefined;
            const entry = store.get(url);
            return new Response(entry.buffer.slice(0), { headers: new Headers(entry.headers) });
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
                caches.set(name, createFakeCache());
            }
            return caches.get(name);
        },
    };
}

function canonicalizePath(path) {
    if (typeof path !== "string" || !path) return "/";
    let normalized = path;
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    normalized = normalized.replace(/\/+/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

function splitPath(path) {
    const full = canonicalizePath(path);
    const index = full.lastIndexOf("/");
    const dirname = index <= 0 ? "/" : full.slice(0, index);
    const basename = full.slice(index + 1);
    return { fullname: full, dirname, basename };
}

function encodeCachePath(path) {
    return VFS_URL_PREFIX + encodeURIComponent(canonicalizePath(path));
}

function cloneBuffer(data) {
    if (!data) return new ArrayBuffer(0);
    if (data instanceof ArrayBuffer) return data.slice(0);
    if (ArrayBuffer.isView(data)) {
        const view = data;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
    if (typeof data === "string") return new TextEncoder().encode(data).buffer;
    return cloneBuffer(new Uint8Array(data));
}

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

async function setupEnvironment() {
    __resetStorageReconcilerForTests();
    const fakeCaches = createFakeCaches();
    global.caches = fakeCaches;

    const existingNamespace = global.Squeak && global.Squeak.StorageReconciliation
        ? global.Squeak.StorageReconciliation
        : {};

    const directories = new Map();
    const files = new Map();
    const settings = {};

    function updateDirectorySettings(dirname, map) {
        const serialized = {};
        map.forEach((entry, name) => { serialized[name] = entry.slice(); });
        settings["squeak:" + dirname] = JSON.stringify(serialized);
    }

    function ensureDirectory(path) {
        const canonical = canonicalizePath(path);
        if (directories.has(canonical)) return directories.get(canonical);
        if (canonical !== "/") {
            const info = splitPath(canonical);
            const parent = ensureDirectory(info.dirname);
            const now = nowSeconds();
            parent.set(info.basename, [info.basename, now, now, true, 0]);
            updateDirectorySettings(info.dirname, parent);
        }
        const dirMap = new Map();
        directories.set(canonical, dirMap);
        if (!settings["squeak:" + canonical]) updateDirectorySettings(canonical, dirMap);
        return dirMap;
    }

    ensureDirectory("/");

    const manifest = { version: 1, updatedAt: Date.now(), totalBytes: 0, files: {} };
    const cache = await fakeCaches.open("squeak-vfs-cache");
    await cache.put(MANIFEST_URL, new Response(JSON.stringify(manifest), {
        headers: { "content-type": "application/json" },
    }));

    const telemetryEvents = [];

    global.Squeak = {
        Settings: settings,
        telemetry: {
            emit(event, payload) {
                telemetryEvents.push({ event, payload });
            },
        },
        StorageReconciliation: existingNamespace,
    };

    global.Squeak.dirList = function(dirpath) {
        const key = canonicalizePath(dirpath === "" ? "/" : dirpath);
        const map = directories.get(key);
        if (!map) return {};
        const result = {};
        map.forEach((entry, name) => { result[name] = entry.slice(); });
        return result;
    };

    global.Squeak.fileExists = function(path) {
        const info = splitPath(path);
        const dir = directories.get(info.dirname);
        if (!dir) return false;
        const entry = dir.get(info.basename);
        return !!(entry && !entry[3]);
    };

    global.Squeak.fileGet = function(path, success, failure) {
        const info = splitPath(path);
        if (!files.has(info.fullname)) {
            if (typeof failure === "function") failure(new Error("not found"));
            return;
        }
        const buffer = files.get(info.fullname);
        setTimeout(() => success(cloneBuffer(buffer)), 0);
    };

    global.Squeak.filePut = function(path, contents) {
        const info = splitPath(path);
        const buffer = cloneBuffer(contents);
        files.set(info.fullname, buffer);
        const dir = ensureDirectory(info.dirname);
        const now = nowSeconds();
        let entry = dir.get(info.basename);
        if (!entry) {
            entry = [info.basename, now, now, false, buffer.byteLength];
            dir.set(info.basename, entry);
        } else {
            entry[2] = now;
            entry[3] = false;
            entry[4] = buffer.byteLength;
        }
        updateDirectorySettings(info.dirname, dir);
        if (global.Squeak.StorageVFS && typeof global.Squeak.StorageVFS.notifyWrite === "function") {
            global.Squeak.StorageVFS.notifyWrite(info.fullname, buffer, {
                size: buffer.byteLength,
                updatedAt: entry[2],
                directory: info.dirname,
            });
        }
        return entry;
    };

    global.Squeak.totalSeconds = nowSeconds;

    function seedLocalFile(path, contents, updatedAt) {
        const info = splitPath(path);
        const buffer = cloneBuffer(contents);
        files.set(info.fullname, buffer);
        const dir = ensureDirectory(info.dirname);
        const timestamp = updatedAt !== undefined ? updatedAt : nowSeconds();
        dir.set(info.basename, [info.basename, timestamp, timestamp, false, buffer.byteLength]);
        updateDirectorySettings(info.dirname, dir);
    }

    async function seedManifestFile(path, contents, updatedAt) {
        const buffer = cloneBuffer(contents);
        manifest.files[path] = {
            size: buffer.byteLength,
            updatedAt: updatedAt,
        };
        manifest.totalBytes = Object.keys(manifest.files).reduce((sum, key) => sum + (manifest.files[key].size || 0), 0);
        manifest.updatedAt = Date.now();
        const headers = new Headers({
            "content-type": "application/octet-stream",
            "x-squeak-path": path,
            "x-squeak-updated-at": String(updatedAt),
            "x-squeak-size": String(buffer.byteLength),
        });
        await cache.put(encodeCachePath(path), new Response(buffer.slice(0), { headers }));
        await cache.put(MANIFEST_URL, new Response(JSON.stringify(manifest), {
            headers: { "content-type": "application/json" },
        }));
    }

    global.Squeak.StorageVFS = {
        getState() {
            return {
                supported: true,
                cacheName: "squeak-vfs-cache",
                manifest: JSON.parse(JSON.stringify(manifest)),
            };
        },
        notifyWrite(path, contents, metadata) {
            const buffer = cloneBuffer(contents);
            const updatedAt = metadata && metadata.updatedAt !== undefined ? metadata.updatedAt : nowSeconds();
            manifest.files[path] = { size: buffer.byteLength, updatedAt };
            manifest.totalBytes = Object.keys(manifest.files).reduce((sum, key) => sum + (manifest.files[key].size || 0), 0);
            manifest.updatedAt = Date.now();
            const headers = new Headers({
                "content-type": "application/octet-stream",
                "x-squeak-path": path,
                "x-squeak-updated-at": String(updatedAt),
                "x-squeak-size": String(buffer.byteLength),
            });
            cache.put(encodeCachePath(path), new Response(buffer.slice(0), { headers })).then(() => {
                cache.put(MANIFEST_URL, new Response(JSON.stringify(manifest), {
                    headers: { "content-type": "application/json" },
                }));
            });
        },
    };

    return {
        manifest,
        cache,
        seedLocalFile,
        seedManifestFile,
        telemetryEvents,
    };
}

async function runStorageReconciliationTest() {
    const { manifest, cache, seedLocalFile, seedManifestFile, telemetryEvents } = await setupEnvironment();
    const textEncoder = new TextEncoder();

    await seedManifestFile("/missing.changes", textEncoder.encode("cached").buffer, 1234);
    seedLocalFile("/local-only.log", textEncoder.encode("local").buffer, 2345);

    const result = await forceStorageReconciliation({ reason: "test" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.strictEqual(global.Squeak.fileExists("/missing.changes"), true, "missing manifest entry should be restored locally");
    assert.ok(manifest.files["/local-only.log"], "local-only file should be registered in manifest");
    const cachedLocal = await cache.match(encodeCachePath("/local-only.log"));
    assert.ok(cachedLocal, "local-only file should be cached");
    assert.ok(result.repairedFromCache.some((entry) => entry.path === "/missing.changes"));
    assert.ok(result.registeredInCache.some((entry) => entry.path === "/local-only.log"));
    const telemetryEvent = telemetryEvents.find((event) => event.event === "storage.reconciliation");
    assert.ok(telemetryEvent, "reconciliation telemetry should be emitted");

    const state = getStorageReconciliationState();
    assert.ok(state.lastRunAt, "state should capture last run timestamp");

    __resetStorageReconcilerForTests();
    const scheduled = scheduleStorageReconciliation(0, { reason: "schedule-test" });
    assert.strictEqual(scheduled, true, "schedule should succeed when supported");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const afterSchedule = getStorageReconciliationState();
    assert.ok(afterSchedule.lastRunAt, "scheduled reconciliation should execute");
    stopStorageReconciler();
}

await runStorageReconciliationTest();
