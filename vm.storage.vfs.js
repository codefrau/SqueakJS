import { updateStorageQuotaManifest, setStorageQuotaVFSSupport, setStorageQuotaEvictionHandler, recordStorageQuotaEvictionResult } from "./vm.storage.quota.js";

"use strict";

const DEFAULT_SCOPE = "./";
const DEFAULT_SCRIPT_URL = "./run/squeak-storage-sw.js";
const DEFAULT_CACHE_NAME = "squeak-vfs-cache";
const STORAGE_CHANNEL = "squeak-storage-vfs";
const VFS_URL_PREFIX = "https://squeak.invalid/vfs/";

const state = {
    supported: false,
    controller: null,
    registrationAttempted: false,
    registrationScope: null,
    registrationUrl: null,
    registrationError: null,
    cacheName: DEFAULT_CACHE_NAME,
    pending: [],
    sequence: 0,
    lastFlushAt: null,
    lastOperationAt: null,
    queuedOperations: 0,
    manifest: null,
    replay: {
        lastRun: null,
        restored: 0,
        errors: 0,
        lastError: null,
    },
};

let registrationPromise = null;
let readyRegistration = null;
let suppressNotifications = false;

function getGlobalObject() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return {};
}

function ensureSqueakNamespace() {
    const global = getGlobalObject();
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.StorageVFS) {
        global.Squeak.StorageVFS = {};
    }
    return global.Squeak.StorageVFS;
}

function nowTimestamp() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
}

function formatError(error) {
    if (!error) return null;
    if (typeof error === "string") {
        return { name: "Error", message: error };
    }
    const formatted = {
        name: typeof error.name === "string" && error.name ? error.name : "Error",
        message: typeof error.message === "string" && error.message ? error.message : String(error),
    };
    if (error.code !== undefined) formatted.code = error.code;
    if (error.type !== undefined) formatted.type = error.type;
    if (error.stack) formatted.stack = String(error.stack);
    return formatted;
}

function cloneBuffer(data) {
    if (!data) return null;
    if (data instanceof ArrayBuffer) {
        return data.slice(0);
    }
    if (ArrayBuffer.isView(data)) {
        const view = data;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
    if (typeof data === "string") {
        const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
        return encoder ? encoder.encode(data).buffer : null;
    }
    return null;
}

function supportsServiceWorker() {
    const global = getGlobalObject();
    const navigatorObj = global.navigator;
    if (!navigatorObj || !navigatorObj.serviceWorker) return false;
    if (typeof global.caches === "undefined") return false;
    return true;
}

function updateController(controller) {
    state.controller = controller || null;
    flushPendingOperations();
}

function listenForControllerChanges() {
    const global = getGlobalObject();
    if (!global.navigator || !global.navigator.serviceWorker) return;
    try {
        global.navigator.serviceWorker.addEventListener("controllerchange", function onControllerChange() {
            updateController(global.navigator.serviceWorker.controller || null);
        });
    } catch (_) {}
}

function postMessageToWorker(message, transferables) {
    if (!state.controller) return false;
    try {
        if (typeof state.controller.postMessage === "function") {
            state.controller.postMessage(message, transferables || []);
            return true;
        }
    } catch (error) {
        state.registrationError = formatError(error);
    }
    return false;
}

function flushPendingOperations() {
    if (!state.pending.length) return;
    if (!state.controller && readyRegistration && readyRegistration.active) {
        state.controller = readyRegistration.active;
    }
    if (!state.controller) return;
    const toSend = state.pending.splice(0, state.pending.length);
    state.queuedOperations = state.pending.length;
    toSend.forEach(function(op) {
        const transfer = [];
        if (op.contents instanceof ArrayBuffer) transfer.push(op.contents);
        postMessageToWorker(op, transfer);
    });
    state.lastFlushAt = nowTimestamp();
}

function enqueueOperation(operation) {
    state.lastOperationAt = nowTimestamp();
    if (!state.supported || suppressNotifications) return;
    operation.channel = STORAGE_CHANNEL;
    operation.cacheName = state.cacheName;
    operation.sequence = ++state.sequence;
    state.pending.push(operation);
    state.queuedOperations = state.pending.length;
    flushPendingOperations();
}

function enqueueEviction(paths, metadata) {
    if (!Array.isArray(paths) || !paths.length) return;
    const payload = Object.assign({
        operation: "evict",
        paths: paths,
    }, metadata || {});
    enqueueOperation(payload);
}

function handleServiceWorkerMessage(event) {
    const data = event && event.data;
    if (!data || data.channel !== STORAGE_CHANNEL) return;
    if (data.type === "manifest") {
        state.manifest = data.manifest || null;
        updateStorageQuotaManifest(state.manifest);
    } else if (data.type === "replay-result") {
        if (data.restored !== undefined) state.replay.restored = data.restored;
        if (data.errors !== undefined) state.replay.errors = data.errors;
        if (data.lastError) state.replay.lastError = data.lastError;
        if (data.timestamp) state.replay.lastRun = data.timestamp;
    } else if (data.type === "eviction-result") {
        recordStorageQuotaEvictionResult({
            paths: Array.isArray(data.paths) ? data.paths : [],
            reclaimedBytes: typeof data.reclaimedBytes === "number" ? data.reclaimedBytes : 0,
            errors: Array.isArray(data.errors) ? data.errors : [],
            timestamp: data.timestamp || Date.now(),
            cacheName: data.cacheName || state.cacheName,
        });
        if (data.manifest) {
            state.manifest = data.manifest;
            updateStorageQuotaManifest(state.manifest);
        }
    }
}

function ensureMessageListener() {
    const global = getGlobalObject();
    const navigatorObj = global.navigator;
    if (!navigatorObj || !navigatorObj.serviceWorker) return;
    if (typeof navigatorObj.serviceWorker.addEventListener === "function") {
        try {
            navigatorObj.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
        } catch (_) {}
    }
}

async function ensureStorageVFSRegistration(options) {
    options = options || {};
    const global = getGlobalObject();
    const navigatorObj = global.navigator;
    state.cacheName = options.cacheName || state.cacheName || DEFAULT_CACHE_NAME;
    if (!state.registrationAttempted) {
        state.supported = supportsServiceWorker();
        setStorageQuotaVFSSupport(state.supported);
        state.registrationAttempted = true;
        ensureMessageListener();
        listenForControllerChanges();
    }
    if (!state.supported || !navigatorObj || !navigatorObj.serviceWorker) {
        setStorageQuotaVFSSupport(state.supported);
        return null;
    }
    if (registrationPromise) {
        return registrationPromise;
    }
    const scriptURL = options.scriptURL || DEFAULT_SCRIPT_URL;
    const scope = options.scope || DEFAULT_SCOPE;
    state.registrationUrl = scriptURL;
    state.registrationScope = scope;
    registrationPromise = navigatorObj.serviceWorker.register(scriptURL, { scope: scope }).then(function(reg) {
        readyRegistration = reg;
        updateController(navigatorObj.serviceWorker.controller || reg.active || null);
        return navigatorObj.serviceWorker.ready.catch(function() { return reg; }).then(function(ready) {
            readyRegistration = ready || reg;
            updateController(navigatorObj.serviceWorker.controller || (readyRegistration && readyRegistration.active) || null);
            return ready;
        });
    }).then(function(reg) {
        if (options.autoReplay !== false) {
            return replayFromCache().catch(function(error) {
                state.replay.lastError = formatError(error);
                return null;
            }).then(function() { return reg; });
        }
        return reg;
    }).catch(function(error) {
        state.registrationError = formatError(error);
        registrationPromise = null;
        throw error;
    });
    return registrationPromise;
}

function notifyWrite(path, contents, metadata) {
    if (!path) return;
    const buffer = cloneBuffer(contents);
    enqueueOperation({
        operation: "write",
        path: path,
        contents: buffer,
        size: metadata && metadata.size !== undefined ? metadata.size : (buffer ? buffer.byteLength : 0),
        updatedAt: metadata && metadata.updatedAt !== undefined ? metadata.updatedAt : Date.now(),
        directory: metadata && metadata.directory ? metadata.directory : null,
    });
}

function notifyDelete(path, metadata) {
    if (!path) return;
    enqueueOperation({
        operation: "delete",
        path: path,
        updatedAt: metadata && metadata.updatedAt !== undefined ? metadata.updatedAt : Date.now(),
        directory: metadata && metadata.directory ? metadata.directory : null,
    });
}

function notifyRename(fromPath, toPath, options) {
    if (!fromPath || !toPath) return;
    const buffer = options && options.contents ? cloneBuffer(options.contents) : null;
    enqueueOperation({
        operation: "rename",
        fromPath: fromPath,
        toPath: toPath,
        contents: buffer,
        size: options && options.size !== undefined ? options.size : (buffer ? buffer.byteLength : 0),
        updatedAt: options && options.updatedAt !== undefined ? options.updatedAt : Date.now(),
        directory: options && options.directory ? options.directory : null,
    });
}

async function replayFromCache(options) {
    options = options || {};
    if (!state.supported) return { restored: 0, errors: 0, skipped: true };
    const cacheName = options.cacheName || state.cacheName || DEFAULT_CACHE_NAME;
    let cache;
    try {
        cache = await caches.open(cacheName);
    } catch (error) {
        state.replay.lastError = formatError(error);
        throw error;
    }
    let requests;
    try {
        requests = await cache.keys();
    } catch (error) {
        state.replay.lastError = formatError(error);
        throw error;
    }
    let restored = 0;
    let errors = 0;
    const SqueakVFS = ensureSqueakNamespace();
    const SqueakGlobal = getGlobalObject().Squeak;
    suppressNotifications = true;
    try {
        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            if (!request || typeof request.url !== "string") continue;
            if (!request.url.startsWith(VFS_URL_PREFIX)) continue;
            if (request.url.endsWith("__manifest__")) continue;
            if (request.url.indexOf("?temp=") !== -1) continue;
            const response = await cache.match(request);
            if (!response) continue;
            let buffer;
            try {
                buffer = await response.arrayBuffer();
            } catch (error) {
                errors++;
                state.replay.lastError = formatError(error);
                continue;
            }
            const encodedPath = request.url.substring(VFS_URL_PREFIX.length);
            let path;
            try {
                path = decodeURIComponent(encodedPath);
            } catch (_) {
                path = encodedPath;
            }
            if (!SqueakGlobal || typeof SqueakGlobal.filePut !== "function") {
                continue;
            }
            try {
                SqueakGlobal.filePut(path, buffer);
                restored++;
            } catch (error) {
                errors++;
                state.replay.lastError = formatError(error);
            }
        }
    } finally {
        suppressNotifications = false;
    }
    state.replay.restored = restored;
    state.replay.errors = errors;
    state.replay.lastRun = Date.now();
    if (SqueakVFS) {
        SqueakVFS.lastReplay = {
            restored: restored,
            errors: errors,
            timestamp: state.replay.lastRun,
        };
    }
    return { restored: restored, errors: errors };
}

function getStateSnapshot() {
    return {
        supported: state.supported,
        registrationAttempted: state.registrationAttempted,
        registrationScope: state.registrationScope,
        registrationUrl: state.registrationUrl,
        registrationError: state.registrationError,
        cacheName: state.cacheName,
        pending: state.pending.length,
        sequence: state.sequence,
        lastFlushAt: state.lastFlushAt,
        lastOperationAt: state.lastOperationAt,
        manifest: state.manifest,
        replay: Object.assign({}, state.replay),
    };
}

const StorageVFS = ensureSqueakNamespace();
StorageVFS.ensureRegistration = ensureStorageVFSRegistration;
StorageVFS.notifyWrite = notifyWrite;
StorageVFS.notifyDelete = notifyDelete;
StorageVFS.notifyRename = notifyRename;
StorageVFS.replayFromCache = replayFromCache;
StorageVFS.getState = getStateSnapshot;
StorageVFS.isSupported = function() { return state.supported; };

setStorageQuotaEvictionHandler(function(paths, metadata) {
    enqueueEviction(paths, {
        requestedBytes: metadata && metadata.targetBytes,
        reclaimedEstimate: metadata && metadata.reclaimedEstimate,
        percentUsed: metadata && metadata.percentUsed,
    });
});

export {
    ensureStorageVFSRegistration,
    notifyWrite as notifyStorageWrite,
    notifyDelete as notifyStorageDelete,
    notifyRename as notifyStorageRename,
    replayFromCache as replayStorageFromCache,
    getStateSnapshot as getStorageVFSState,
};

