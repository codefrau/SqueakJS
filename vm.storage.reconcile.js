import {
    emitStorageErrorTelemetry,
    emitStorageReconciliationTelemetry,
} from "./vm.storage.telemetry.js";

"use strict";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_NAME = "squeak-vfs-cache";
const VFS_URL_PREFIX = "https://squeak.invalid/vfs/";
const MANIFEST_URL = VFS_URL_PREFIX + "__manifest__";

const state = {
    supported: false,
    intervalMs: DEFAULT_INTERVAL_MS,
    timer: null,
    pending: null,
    lastRunAt: null,
    lastResult: null,
    lastError: null,
    consecutiveFailures: 0,
    nextReason: null,
    shadowManifest: null,
};

function getGlobalObject() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return {};
}

function ensureNamespace() {
    const global = getGlobalObject();
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.StorageReconciliation || typeof global.Squeak.StorageReconciliation !== "object") {
        global.Squeak.StorageReconciliation = {};
    }
    return global.Squeak.StorageReconciliation;
}

function nowMs() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function canonicalizePath(path) {
    if (typeof path !== "string") return null;
    let normalized = path.trim();
    if (!normalized) return null;
    normalized = normalized.replace(/\\/g, "/");
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    normalized = normalized.replace(/\/+/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

function canonicalizeDirectory(path) {
    const normalized = canonicalizePath(path || "/");
    if (!normalized) return "/";
    return normalized === "" ? "/" : normalized;
}

function joinPath(dir, name) {
    if (!name) return canonicalizePath(dir);
    const base = canonicalizeDirectory(dir);
    if (base === "/") return canonicalizePath("/" + name);
    return canonicalizePath(base + "/" + name);
}

function parentDirectory(path) {
    const normalized = canonicalizePath(path);
    if (!normalized || normalized === "/") return "/";
    const index = normalized.lastIndexOf("/");
    if (index <= 0) return "/";
    return normalized.slice(0, index);
}

function cloneBuffer(buffer) {
    if (!buffer) return null;
    if (buffer instanceof ArrayBuffer) {
        return buffer.slice(0);
    }
    if (ArrayBuffer.isView(buffer)) {
        const view = buffer;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
    if (typeof buffer === "string") {
        if (typeof TextEncoder !== "undefined") {
            return new TextEncoder().encode(buffer).buffer;
        }
        const bytes = new Uint8Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) bytes[i] = buffer.charCodeAt(i) & 0xFF;
        return bytes.buffer;
    }
    return null;
}

function computeChecksum(buffer) {
    if (!(buffer instanceof ArrayBuffer)) return null;
    const view = new Uint8Array(buffer);
    let a = 1;
    let b = 0;
    for (let i = 0; i < view.length; i++) {
        a = (a + view[i]) % 65521;
        b = (b + a) % 65521;
    }
    const checksum = ((b << 16) | a) >>> 0;
    return checksum.toString(16).padStart(8, "0");
}

function formatError(error) {
    if (!error) return null;
    if (typeof error === "string") return { name: "Error", message: error };
    const formatted = {
        name: error && error.name ? error.name : "Error",
        message: error && error.message ? error.message : String(error),
    };
    if (error.code !== undefined) formatted.code = error.code;
    if (error.type !== undefined) formatted.type = error.type;
    if (error.reason !== undefined && formatted.reason === undefined) formatted.reason = error.reason;
    return formatted;
}

function evaluateSupport() {
    const global = getGlobalObject();
    const squeak = global.Squeak;
    const caches = global.caches;
    const hasCaches = !!(caches && typeof caches.open === "function");
    const hasFiles = !!(squeak && typeof squeak.dirList === "function" && typeof squeak.fileExists === "function" &&
        typeof squeak.fileGet === "function" && typeof squeak.filePut === "function");
    const hasVFS = !!(squeak && squeak.StorageVFS && typeof squeak.StorageVFS.getState === "function");
    state.supported = hasCaches && hasFiles && hasVFS;
    return state.supported;
}

function clearTimer() {
    if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }
}

function scheduleNext(delayMs, reason) {
    if (!state.supported) return false;
    clearTimer();
    const delay = typeof delayMs === "number" && delayMs >= 0 ? delayMs : state.intervalMs;
    if (delay === null || delay === undefined) return false;
    state.nextReason = reason || null;
    state.timer = setTimeout(function() {
        state.timer = null;
        const runReason = state.nextReason || "scheduled";
        state.nextReason = null;
        forceStorageReconciliation({ reason: runReason }).catch(function() {});
    }, delay);
    return true;
}

function startStorageReconciler(options) {
    options = options || {};
    if (typeof options.intervalMs === "number" && options.intervalMs >= 0) {
        state.intervalMs = options.intervalMs;
    }
    evaluateSupport();
    if (!state.supported) return false;
    if (options.immediate) {
        forceStorageReconciliation({ reason: options.reason || "start" }).catch(function() {});
    } else {
        scheduleNext(typeof options.initialDelay === "number" ? options.initialDelay : state.intervalMs, options.reason || "start");
    }
    return true;
}

function stopStorageReconciler() {
    clearTimer();
    state.pending = null;
    state.nextReason = null;
}

function scheduleStorageReconciliation(delayMs, metadata) {
    evaluateSupport();
    if (!state.supported) return false;
    return scheduleNext(typeof delayMs === "number" ? delayMs : state.intervalMs, metadata && metadata.reason ? metadata.reason : null);
}

function readLocalFile(squeak, path) {
    return new Promise(function(resolve, reject) {
        try {
            squeak.fileGet(path, function(data) {
                try {
                    const buffer = cloneBuffer(data);
                    if (buffer) resolve(buffer);
                    else reject(new Error("Unable to clone local file buffer"));
                } catch (error) {
                    reject(error);
                }
            }, function(error) {
                reject(error instanceof Error ? error : new Error(String(error)));
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function loadManifestSnapshot(caches, cacheName, existingManifest) {
    if (existingManifest && typeof existingManifest === "object") {
        try {
            return JSON.parse(JSON.stringify(existingManifest));
        } catch (_) {
            // fall through to fetch from cache
        }
    }
    try {
        const cache = await caches.open(cacheName || DEFAULT_CACHE_NAME);
        const response = await cache.match(MANIFEST_URL);
        if (!response) {
            return { version: 1, updatedAt: Date.now(), totalBytes: 0, files: {} };
        }
        const manifest = await response.json();
        if (!manifest || typeof manifest !== "object") {
            return { version: 1, updatedAt: Date.now(), totalBytes: 0, files: {} };
        }
        if (!manifest.files || typeof manifest.files !== "object") manifest.files = {};
        if (typeof manifest.totalBytes !== "number") manifest.totalBytes = 0;
        return manifest;
    } catch (error) {
        state.lastError = formatError(error);
        emitStorageErrorTelemetry(error, { stage: "reconciliation", operation: "load-manifest" });
        return { version: 1, updatedAt: Date.now(), totalBytes: 0, files: {} };
    }
}

function buildManifestMap(manifest) {
    const map = new Map();
    if (!manifest || !manifest.files) return map;
    Object.keys(manifest.files).forEach(function(path) {
        const entry = manifest.files[path] || {};
        const canonical = canonicalizePath(path);
        if (!canonical) return;
        map.set(canonical, {
            path: path,
            canonical: canonical,
            size: typeof entry.size === "number" && entry.size >= 0 ? entry.size : 0,
            updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : (manifest.updatedAt || Date.now()),
        });
    });
    return map;
}

function collectLocalEntries(squeak) {
    const entries = new Map();
    const visited = new Set();
    function visit(dir) {
        const key = canonicalizeDirectory(dir);
        if (visited.has(key)) return;
        visited.add(key);
        let listing = null;
        try {
            listing = squeak.dirList(key === "/" ? "" : key);
        } catch (_) {}
        if (!listing && key !== "/") {
            try { listing = squeak.dirList(key); } catch (_) {}
        }
        if (!listing) return;
        Object.keys(listing).forEach(function(name) {
            const entry = listing[name];
            if (!entry || entry[0] === undefined) return;
            const childPath = joinPath(key, entry[0]);
            if (entry[3]) {
                visit(childPath);
            } else {
                entries.set(canonicalizePath(childPath), {
                    path: childPath,
                    canonical: canonicalizePath(childPath),
                    size: typeof entry[4] === "number" && entry[4] >= 0 ? entry[4] : 0,
                    updatedAt: typeof entry[2] === "number" ? entry[2] : null,
                    entry: entry,
                });
            }
        });
    }
    visit("/");
    return entries;
}

function encodeCachePath(path) {
    const normalized = canonicalizePath(path);
    if (!normalized) return null;
    return VFS_URL_PREFIX + encodeURIComponent(normalized);
}

async function restoreFromCache(cache, manifestEntry, squeak) {
    try {
        const url = encodeCachePath(manifestEntry.path);
        if (!url) throw new Error("invalid-manifest-path");
        const response = await cache.match(url);
        if (!response) {
            return { success: false, error: new Error("cache-miss") };
        }
        const buffer = await response.arrayBuffer();
        const checksum = computeChecksum(buffer);
        squeak.filePut(manifestEntry.path, buffer);
        return {
            success: true,
            size: buffer.byteLength,
            checksum: checksum,
            updatedAt: manifestEntry.updatedAt,
        };
    } catch (error) {
        return { success: false, error: error };
    }
}

async function registerLocalFile(cache, storageVFS, localEntry, squeak, manifestSnapshot) {
    try {
        const buffer = await readLocalFile(squeak, localEntry.path);
        const checksum = computeChecksum(buffer);
        const updatedAt = typeof localEntry.updatedAt === "number" ? localEntry.updatedAt : Math.floor(Date.now() / 1000);
        if (storageVFS && typeof storageVFS.notifyWrite === "function") {
            storageVFS.notifyWrite(localEntry.path, buffer, {
                size: buffer.byteLength,
                updatedAt: updatedAt,
                directory: parentDirectory(localEntry.path),
            });
        } else {
            await writeCacheEntry(cache, localEntry.path, buffer, updatedAt, manifestSnapshot);
        }
        return {
            success: true,
            size: buffer.byteLength,
            checksum: checksum,
            updatedAt: updatedAt,
        };
    } catch (error) {
        return { success: false, error: error };
    }
}

async function writeCacheEntry(cache, path, buffer, updatedAt, manifestSnapshot) {
    const url = encodeCachePath(path);
    if (!url) throw new Error("invalid-path");
    const headers = new Headers({
        "content-type": "application/octet-stream",
        "x-squeak-path": path,
        "x-squeak-updated-at": String(updatedAt || Date.now()),
        "x-squeak-size": String(buffer.byteLength),
    });
    await cache.put(url, new Response(buffer.slice(0), { headers }));
    if (!manifestSnapshot || !manifestSnapshot.files) return;
    manifestSnapshot.files[path] = {
        size: buffer.byteLength,
        updatedAt: updatedAt,
    };
    manifestSnapshot.totalBytes = Object.keys(manifestSnapshot.files).reduce(function(sum, key) {
        const entry = manifestSnapshot.files[key] || {};
        return sum + (typeof entry.size === "number" ? entry.size : 0);
    }, 0);
    manifestSnapshot.updatedAt = Date.now();
    await cache.put(MANIFEST_URL, new Response(JSON.stringify(manifestSnapshot), {
        headers: { "content-type": "application/json" },
    }));
}

async function resolveDivergence(cache, storageVFS, manifestEntry, localEntry, squeak, manifestSnapshot, result) {
    const manifestUpdated = typeof manifestEntry.updatedAt === "number" ? manifestEntry.updatedAt : 0;
    const localUpdated = typeof localEntry.updatedAt === "number" ? localEntry.updatedAt : 0;
    if (manifestUpdated >= localUpdated) {
        const restore = await restoreFromCache(cache, manifestEntry, squeak);
        if (restore.success) {
            result.repairedFromCache.push({
                path: manifestEntry.canonical,
                size: restore.size,
                checksum: restore.checksum,
                source: "manifest",
            });
            return;
        }
        result.issues.push({
            path: manifestEntry.canonical,
            type: "divergence",
            detail: "cache-restore-failed",
            error: formatError(restore.error),
        });
    } else {
        const registration = await registerLocalFile(cache, storageVFS, localEntry, squeak, manifestSnapshot);
        if (registration.success) {
            result.registeredInCache.push({
                path: localEntry.canonical,
                size: registration.size,
                checksum: registration.checksum,
                source: "local",
            });
            return;
        }
        result.issues.push({
            path: localEntry.canonical,
            type: "divergence",
            detail: "manifest-update-failed",
            error: formatError(registration.error),
        });
    }
}

async function runReconciliation(options) {
    const startTime = nowMs();
    const timestamp = Date.now();
    const result = {
        timestamp: timestamp,
        reason: options && options.reason ? options.reason : null,
        cacheName: null,
        manifestVersion: null,
        manifestCount: 0,
        localCount: 0,
        repairedFromCache: [],
        registeredInCache: [],
        issues: [],
        durationMs: 0,
        supported: state.supported,
        skipped: false,
    };

    evaluateSupport();
    if (!state.supported) {
        result.skipped = true;
        result.supported = false;
        result.durationMs = nowMs() - startTime;
        state.lastResult = result;
        state.lastRunAt = timestamp;
        return result;
    }

    const global = getGlobalObject();
    const squeak = global.Squeak;
    const storageVFS = squeak && squeak.StorageVFS;
    const caches = global.caches;
    const vfsState = storageVFS && typeof storageVFS.getState === "function" ? storageVFS.getState() || {} : {};
    const cacheName = options && options.cacheName ? options.cacheName : (vfsState.cacheName || DEFAULT_CACHE_NAME);
    result.cacheName = cacheName;

    const manifestSnapshot = await loadManifestSnapshot(caches, cacheName, vfsState.manifest);
    state.shadowManifest = manifestSnapshot ? JSON.parse(JSON.stringify(manifestSnapshot)) : null;
    result.manifestVersion = manifestSnapshot && manifestSnapshot.version ? manifestSnapshot.version : 1;

    const manifestMap = buildManifestMap(manifestSnapshot);
    result.manifestCount = manifestMap.size;

    const localEntries = collectLocalEntries(squeak);
    result.localCount = localEntries.size;

    const cache = await caches.open(cacheName || DEFAULT_CACHE_NAME);

    for (const [canonical, manifestEntry] of manifestMap.entries()) {
        const localEntry = localEntries.get(canonical);
        if (!localEntry) {
            const restore = await restoreFromCache(cache, manifestEntry, squeak);
            if (restore.success) {
                result.repairedFromCache.push({
                    path: canonical,
                    size: restore.size,
                    checksum: restore.checksum,
                    source: "manifest",
                });
            } else {
                result.issues.push({
                    path: canonical,
                    type: "missing-local",
                    error: formatError(restore.error),
                });
            }
            continue;
        }
        if (localEntry.size !== manifestEntry.size) {
            await resolveDivergence(cache, storageVFS, manifestEntry, localEntry, squeak, manifestSnapshot, result);
        }
    }

    for (const [canonical, localEntry] of localEntries.entries()) {
        if (manifestMap.has(canonical)) continue;
        const registration = await registerLocalFile(cache, storageVFS, localEntry, squeak, manifestSnapshot);
        if (registration.success) {
            result.registeredInCache.push({
                path: canonical,
                size: registration.size,
                checksum: registration.checksum,
                source: "local",
            });
        } else {
            result.issues.push({
                path: canonical,
                type: "missing-manifest",
                error: formatError(registration.error),
            });
        }
    }

    result.durationMs = nowMs() - startTime;
    result.success = result.issues.length === 0;
    emitStorageReconciliationTelemetry({
        timestamp: result.timestamp,
        reason: result.reason,
        cacheName: result.cacheName,
        manifestCount: result.manifestCount,
        localCount: result.localCount,
        repaired: result.repairedFromCache.length,
        registered: result.registeredInCache.length,
        issues: result.issues,
        durationMs: result.durationMs,
    });
    state.lastResult = result;
    state.lastRunAt = timestamp;
    return result;
}

function forceStorageReconciliation(options) {
    options = options || {};
    evaluateSupport();
    if (!state.supported) {
        const skipped = {
            timestamp: Date.now(),
            reason: options.reason || null,
            skipped: true,
            supported: false,
            issues: [{ type: "unsupported" }],
        };
        state.lastResult = skipped;
        state.lastRunAt = skipped.timestamp;
        return Promise.resolve(skipped);
    }
    if (state.pending) {
        return state.pending;
    }
    const promise = runReconciliation(options).then(function(result) {
        state.lastError = null;
        state.consecutiveFailures = 0;
        state.pending = null;
        if (!options.skipSchedule) {
            scheduleNext(state.intervalMs, "interval");
        }
        return result;
    }).catch(function(error) {
        state.lastError = formatError(error);
        state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
        state.pending = null;
        emitStorageErrorTelemetry(error, { stage: "reconciliation", reason: options.reason || null });
        const retryDelay = Math.min(state.intervalMs * Math.max(state.consecutiveFailures, 1), state.intervalMs * 4);
        scheduleNext(retryDelay, "retry");
        throw error;
    });
    state.pending = promise;
    return promise;
}

function getStorageReconciliationState() {
    return {
        supported: state.supported,
        intervalMs: state.intervalMs,
        timerActive: !!state.timer,
        pending: !!state.pending,
        lastRunAt: state.lastRunAt,
        lastResult: state.lastResult,
        lastError: state.lastError,
        consecutiveFailures: state.consecutiveFailures,
        nextReason: state.nextReason,
    };
}

function __resetStorageReconcilerForTests() {
    stopStorageReconciler();
    state.supported = false;
    state.intervalMs = DEFAULT_INTERVAL_MS;
    state.lastRunAt = null;
    state.lastResult = null;
    state.lastError = null;
    state.consecutiveFailures = 0;
    state.pending = null;
    state.nextReason = null;
    state.shadowManifest = null;
}

const namespace = ensureNamespace();
Object.assign(namespace, {
    start: startStorageReconciler,
    stop: stopStorageReconciler,
    force: forceStorageReconciliation,
    schedule: scheduleStorageReconciliation,
    getState: getStorageReconciliationState,
});

export {
    startStorageReconciler,
    stopStorageReconciler,
    scheduleStorageReconciliation,
    forceStorageReconciliation,
    getStorageReconciliationState,
    __resetStorageReconcilerForTests,
};

