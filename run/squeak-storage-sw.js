/*
 * SqueakJS storage VFS service worker
 */

const STORAGE_CHANNEL = "squeak-storage-vfs";
const DEFAULT_CACHE_NAME = "squeak-vfs-cache";
const VFS_URL_PREFIX = "https://squeak.invalid/vfs/";
const MANIFEST_URL = VFS_URL_PREFIX + "__manifest__";

self.addEventListener("install", function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("message", function(event) {
    const data = event && event.data;
    if (!data || data.channel !== STORAGE_CHANNEL) return;
    const operation = data.operation;
    const cacheName = data.cacheName || DEFAULT_CACHE_NAME;
    const promise = handleOperation(operation, cacheName, data).catch(function(error) {
        return broadcastError(cacheName, error);
    });
    event.waitUntil(promise);
});

async function handleOperation(operation, cacheName, data) {
    if (operation === "write") {
        await persistWrite(cacheName, data);
    } else if (operation === "delete") {
        await deleteEntry(cacheName, data.path);
    } else if (operation === "rename") {
        await renameEntry(cacheName, data);
    } else if (operation === "ping") {
        await broadcastManifest(cacheName);
    } else if (operation === "evict") {
        await evictEntries(cacheName, data);
    }
}

function encodePath(path) {
    return VFS_URL_PREFIX + encodeURIComponent(path);
}

async function openCache(cacheName) {
    return caches.open(cacheName || DEFAULT_CACHE_NAME);
}

async function readManifest(cache) {
    const response = await cache.match(MANIFEST_URL);
    if (!response) {
        return {
            version: 1,
            updatedAt: Date.now(),
            totalBytes: 0,
            files: {},
        };
    }
    try {
        const json = await response.json();
        if (json && typeof json === "object") {
            if (!json.files || typeof json.files !== "object") json.files = {};
            if (typeof json.totalBytes !== "number") json.totalBytes = 0;
            if (!json.version) json.version = 1;
            return json;
        }
    } catch (_) {}
    return {
        version: 1,
        updatedAt: Date.now(),
        totalBytes: 0,
        files: {},
    };
}

async function writeManifest(cache, manifest, cacheName) {
    const copy = Object.assign({}, manifest, { updatedAt: Date.now() });
    await cache.put(MANIFEST_URL, new Response(JSON.stringify(copy), {
        headers: { "content-type": "application/json" },
    }));
    await broadcastManifest(cacheName || DEFAULT_CACHE_NAME, copy);
}

async function broadcastManifest(cacheName, manifest) {
    if (!manifest) {
        const cache = await openCache(cacheName);
        manifest = await readManifest(cache);
    }
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach(function(client) {
        try {
            client.postMessage({
                channel: STORAGE_CHANNEL,
                type: "manifest",
                manifest: manifest,
            });
        } catch (_) {}
    });
}

async function broadcastReplayResult(result) {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach(function(client) {
        try {
            client.postMessage(Object.assign({
                channel: STORAGE_CHANNEL,
                type: "replay-result",
                timestamp: Date.now(),
            }, result));
        } catch (_) {}
    });
}

async function broadcastEvictionResult(cacheName, result) {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const payload = Object.assign({
        channel: STORAGE_CHANNEL,
        type: "eviction-result",
        cacheName: cacheName,
        timestamp: Date.now(),
    }, result || {});
    clients.forEach(function(client) {
        try { client.postMessage(payload); } catch (_) {}
    });
}

async function broadcastError(cacheName, error) {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const payload = {
        channel: STORAGE_CHANNEL,
        type: "replay-result",
        timestamp: Date.now(),
        lastError: formatError(error),
        cacheName: cacheName,
    };
    clients.forEach(function(client) {
        try { client.postMessage(payload); } catch (_) {}
    });
}

function formatError(error) {
    if (!error) return null;
    if (typeof error === "string") return { name: "Error", message: error };
    return {
        name: error && error.name ? error.name : "Error",
        message: error && error.message ? error.message : String(error),
    };
}

async function persistWrite(cacheName, data) {
    const cache = await openCache(cacheName);
    const manifest = await readManifest(cache);
    const path = data.path;
    if (!path) return;
    const buffer = data.contents instanceof ArrayBuffer ? data.contents : null;
    const request = new Request(encodePath(path));
    const tempRequest = new Request(encodePath(path) + "?temp=" + Date.now() + "-" + (data.sequence || 0));
    const headers = new Headers({
        "content-type": "application/octet-stream",
        "x-squeak-path": path,
        "x-squeak-updated-at": String(data.updatedAt || Date.now()),
        "x-squeak-size": String(buffer ? buffer.byteLength : data.size || 0),
    });
    const response = new Response(buffer || new ArrayBuffer(0), { headers });
    await cache.put(tempRequest, response.clone());
    await cache.delete(request);
    await cache.put(request, response);
    await cache.delete(tempRequest);
    const size = buffer ? buffer.byteLength : data.size || 0;
    const previous = manifest.files[path];
    manifest.files[path] = {
        size: size,
        updatedAt: data.updatedAt || Date.now(),
    };
    manifest.totalBytes += size - (previous ? previous.size || 0 : 0);
    await writeManifest(cache, manifest, cacheName);
}

async function deleteEntry(cacheName, path) {
    if (!path) return;
    const cache = await openCache(cacheName);
    const manifest = await readManifest(cache);
    const request = new Request(encodePath(path));
    await cache.delete(request);
    const entry = manifest.files[path];
    if (entry) {
        manifest.totalBytes -= entry.size || 0;
        delete manifest.files[path];
        await writeManifest(cache, manifest, cacheName);
    }
}

async function renameEntry(cacheName, data) {
    const cache = await openCache(cacheName);
    const manifest = await readManifest(cache);
    const fromRequest = new Request(encodePath(data.fromPath));
    const toRequest = new Request(encodePath(data.toPath));
    let response = await cache.match(fromRequest);
    let buffer;
    let size = 0;
    if (response) {
        buffer = await response.arrayBuffer();
        size = buffer.byteLength;
    } else if (data.contents instanceof ArrayBuffer) {
        buffer = data.contents;
        size = buffer.byteLength;
    }
    if (buffer) {
        const headers = new Headers({
            "content-type": "application/octet-stream",
            "x-squeak-path": data.toPath,
            "x-squeak-updated-at": String(data.updatedAt || Date.now()),
            "x-squeak-size": String(size),
        });
        await cache.put(toRequest, new Response(buffer, { headers }));
        manifest.files[data.toPath] = {
            size: size,
            updatedAt: data.updatedAt || Date.now(),
        };
    }
    await cache.delete(fromRequest);
    const previous = manifest.files[data.fromPath];
    if (previous) {
        manifest.totalBytes -= previous.size || 0;
        delete manifest.files[data.fromPath];
    }
    if (manifest.files[data.toPath]) {
        manifest.totalBytes += manifest.files[data.toPath].size || 0;
    }
    await writeManifest(cache, manifest, cacheName);
}

async function evictEntries(cacheName, data) {
    const cache = await openCache(cacheName);
    const manifest = await readManifest(cache);
    const paths = Array.isArray(data && data.paths) ? data.paths : [];
    const removedPaths = [];
    const errors = [];
    let reclaimedBytes = 0;
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        if (!path) continue;
        const request = new Request(encodePath(path));
        try {
            const response = await cache.match(request);
            let entrySize = 0;
            if (response) {
                const buffer = await response.arrayBuffer();
                entrySize = buffer.byteLength;
            }
            await cache.delete(request);
            const entry = manifest.files[path];
            if (entry && typeof entry.size === "number") {
                manifest.totalBytes -= entry.size;
                if (!entrySize) entrySize = entry.size;
            }
            delete manifest.files[path];
            reclaimedBytes += entrySize;
            removedPaths.push(path);
        } catch (error) {
            errors.push(formatError(error));
        }
    }
    if (manifest.totalBytes < 0) manifest.totalBytes = 0;
    if (reclaimedBytes < 0) reclaimedBytes = 0;
    await writeManifest(cache, manifest, cacheName);
    await broadcastEvictionResult(cacheName, {
        paths: removedPaths,
        reclaimedBytes: reclaimedBytes,
        errors: errors,
        manifest: manifest,
    });
}

self.replayVFSCache = async function(cacheName) {
    const cache = await openCache(cacheName || DEFAULT_CACHE_NAME);
    const requests = await cache.keys();
    let restored = 0;
    let errors = 0;
    for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        if (!request || typeof request.url !== "string") continue;
        if (!request.url.startsWith(VFS_URL_PREFIX)) continue;
        if (request.url.endsWith("__manifest__")) continue;
        if (request.url.indexOf("?temp=") !== -1) continue;
        restored++;
    }
    await broadcastReplayResult({ restored: restored, errors: errors });
    return { restored, errors };
};

