"use strict";

const DEFAULT_TOTAL_TIMEOUT_MS = 120;
const DEFAULT_CACHE_REQUEST = "https://squeak-js.invalid/storage-capability";
const PROBE_PREFIX = "squeak-capability-";

let cachedReport = null;
let pendingDetection = null;
let lastTelemetrySignature = null;

function getGlobalObject() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    return null;
}

function ensureBrowserState() {
    var global = getGlobalObject();
    if (!global) return null;
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.BrowserVMState || typeof global.Squeak.BrowserVMState !== "object") {
        global.Squeak.BrowserVMState = {};
    }
    return global.Squeak.BrowserVMState;
}

function nowMs() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function toISOString(value) {
    try {
        return new Date(value).toISOString();
    } catch (_) {
        try {
            return new Date().toISOString();
        } catch (__) {
            return null;
        }
    }
}

function formatError(error) {
    if (!error) return null;
    if (typeof error === "string") {
        return { name: "Error", message: error };
    }
    var name = typeof error.name === "string" && error.name ? error.name : "Error";
    var message = typeof error.message === "string" && error.message ? error.message : String(error);
    var formatted = { name: name, message: message };
    if (error.code !== undefined) formatted.code = error.code;
    if (error.type !== undefined && formatted.type === undefined) formatted.type = error.type;
    if (error.reason !== undefined && formatted.reason === undefined && typeof error.reason === "string") {
        formatted.reason = error.reason;
    }
    return formatted;
}

function createTimeoutError(probeName) {
    var error = new Error("Storage capability probe '" + probeName + "' timed out");
    error.name = "TimeoutError";
    error.probe = probeName;
    return error;
}

function createAbortError(signal, probeName) {
    var reason = signal && signal.reason;
    if (reason instanceof Error) {
        var tagged = new Error(reason.message);
        tagged.name = reason.name || "AbortError";
        tagged.probe = probeName;
        tagged.stack = reason.stack;
        return tagged;
    }
    var error = new Error(reason ? String(reason) : "Operation aborted");
    error.name = "AbortError";
    error.probe = probeName;
    return error;
}

function updatePendingState(isPending) {
    var state = ensureBrowserState();
    if (state) state.storageCapabilitiesPending = !!isPending;
}

function recordDetectionError(error) {
    var state = ensureBrowserState();
    if (!state) return;
    state.storageCapabilitiesError = formatError(error);
}

function recordReport(report) {
    cachedReport = report || null;
    var state = ensureBrowserState();
    if (state) {
        state.storageCapabilities = cachedReport;
        state.storageCapabilitiesTimestamp = cachedReport && cachedReport.timestamp
            ? cachedReport.timestamp
            : toISOString(Date.now());
    }
    return cachedReport;
}

function emitTelemetry(report) {
    if (!report) return;
    var signature;
    try {
        signature = JSON.stringify({ probes: report.probes, origin: report.origin });
    } catch (_) {
        signature = null;
    }
    if (signature && signature === lastTelemetrySignature) return;
    lastTelemetrySignature = signature || lastTelemetrySignature;
    var global = getGlobalObject();
    var squeak = global && global.Squeak;
    var handled = false;
    if (squeak && squeak.telemetry && typeof squeak.telemetry.emit === "function") {
        try {
            squeak.telemetry.emit("storage.capability", report);
            handled = true;
        } catch (error) {
            if (typeof console !== "undefined" && console.warn) {
                console.warn("[SqueakJS][storage] telemetry emit failed", error);
            }
        }
    }
    if (!handled && typeof console !== "undefined" && console.info) {
        console.info("[SqueakJS][storage] capability report", report);
    }
}

function normalizeProbeResult(result) {
    if (!result || typeof result !== "object") {
        return { supported: false, mode: "unknown" };
    }
    var supported = !!result.supported;
    var normalized = {
        supported: supported,
        mode: typeof result.mode === "string" && result.mode ? result.mode : (supported ? "unknown" : "unsupported"),
    };
    if (result.details !== undefined) normalized.details = result.details;
    if (result.error) normalized.error = formatError(result.error);
    if (Array.isArray(result.errors)) {
        normalized.errors = result.errors.map(formatError).filter(Boolean);
    }
    if (result.note) normalized.note = result.note;
    if (result.durationMs !== undefined) normalized.durationMs = result.durationMs;
    return normalized;
}

function runWithAbort(executor, signal, timeoutMs, timeoutFactory, probeName) {
    return new Promise(function(resolve, reject) {
        var settled = false;
        var timer = null;
        var abortHandler = null;
        function cleanup() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            if (signal && abortHandler) {
                signal.removeEventListener("abort", abortHandler);
                abortHandler = null;
            }
        }
        function done(value, isError) {
            if (settled) return;
            settled = true;
            cleanup();
            if (isError) reject(value);
            else resolve(value);
        }
        if (signal) {
            if (signal.aborted) {
                done(createAbortError(signal, probeName), true);
                return;
            }
            abortHandler = function() {
                done(createAbortError(signal, probeName), true);
            };
            signal.addEventListener("abort", abortHandler, { once: true });
        }
        if (typeof timeoutMs === "number" && isFinite(timeoutMs) && timeoutMs > 0) {
            timer = setTimeout(function() {
                done(typeof timeoutFactory === "function" ? timeoutFactory() : createTimeoutError(probeName), true);
            }, timeoutMs);
        }
        try {
            Promise.resolve().then(executor).then(function(value) {
                done(value, false);
            }).catch(function(error) {
                done(error, true);
            });
        } catch (error) {
            done(error, true);
        }
    });
}

function supportsLocalStorage(global) {
    if (!global) return false;
    try {
        if (!global.localStorage) return false;
    } catch (_) {
        return false;
    }
    return true;
}

async function probeLocalStorage(context) {
    var global = getGlobalObject();
    if (!supportsLocalStorage(global)) {
        return { supported: false, mode: "unsupported" };
    }
    var storage;
    try {
        storage = global.localStorage;
    } catch (_) {
        return { supported: false, mode: "blocked", error: { name: "SecurityError", message: "localStorage inaccessible" } };
    }
    var key = PROBE_PREFIX + "localStorage";
    try {
        storage.setItem(key, "1");
        var value = storage.getItem(key);
        storage.removeItem(key);
        return {
            supported: true,
            mode: value === "1" ? "readwrite" : "readonly",
        };
    } catch (error) {
        return {
            supported: true,
            mode: "blocked",
            error: error,
        };
    }
}

async function probeCacheStorage(context) {
    if (typeof caches === "undefined" || !caches || typeof caches.open !== "function") {
        return { supported: false, mode: "unsupported" };
    }
    var cacheName = PROBE_PREFIX + "cache" + Math.random().toString(36).slice(2);
    try {
        var cache = await caches.open(cacheName);
        if (!cache) {
            return { supported: true, mode: "blocked", error: { name: "CacheError", message: "Unable to open cache" } };
        }
        var request = new Request(DEFAULT_CACHE_REQUEST + "?id=" + cacheName, { method: "GET" });
        await cache.put(request, new Response("ok", { headers: { "Content-Type": "text/plain" } }));
        var match = await cache.match(request);
        await cache.delete(request);
        await caches.delete(cacheName);
        return {
            supported: true,
            mode: match ? "readwrite" : "readonly",
            details: match ? { bytes: (await match.clone().text()).length } : undefined,
        };
    } catch (error) {
        try { await caches.delete(cacheName); } catch (_) {}
        return {
            supported: true,
            mode: "blocked",
            error: error,
        };
    }
}

async function probeIndexedDB(context) {
    if (typeof indexedDB === "undefined" || !indexedDB) {
        return { supported: false, mode: "unsupported" };
    }
    var dbName = PROBE_PREFIX + "indexeddb" + Math.random().toString(36).slice(2);
    var metadata = {};
    if (typeof indexedDB.databases === "function") {
        try {
            var list = await indexedDB.databases();
            metadata.enumeratedDatabases = Array.isArray(list) ? list.length : null;
            if (Array.isArray(list)) {
                metadata.versionedDatabases = list.some(function(entry) {
                    return entry && typeof entry.version === "number";
                });
            }
        } catch (error) {
            metadata.enumerationError = formatError(error);
        }
    }
    return new Promise(function(resolve) {
        var resolved = false;
        function done(result) {
            if (resolved) return;
            resolved = true;
            if (result) {
                if (result.details) {
                    result.details = Object.assign({}, metadata, result.details);
                } else if (Object.keys(metadata).length) {
                    result.details = metadata;
                }
            }
            resolve(result);
        }
        var request;
        try {
            request = indexedDB.open(dbName, 1);
        } catch (error) {
            done({ supported: false, mode: "blocked", error: error, details: metadata });
            return;
        }
        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            try {
                if (db && !db.objectStoreNames.contains("probe")) {
                    db.createObjectStore("probe");
                }
            } catch (error) {
                metadata.upgradeError = formatError(error);
            }
        };
        request.onerror = function(event) {
            var error = event && event.target ? event.target.error : null;
            done({ supported: true, mode: "blocked", error: error, details: metadata });
        };
        request.onblocked = function(event) {
            var error = event && event.target ? event.target.error : null;
            done({ supported: true, mode: "blocked", error: error, details: metadata });
        };
        request.onsuccess = function(event) {
            var db = event.target.result;
            function cleanup() {
                if (db) {
                    try { db.close(); } catch (_) {}
                }
                try {
                    var deleteRequest = indexedDB.deleteDatabase(dbName);
                    deleteRequest.onerror = deleteRequest.onblocked = deleteRequest.onsuccess = function() {};
                } catch (_) {}
            }
            try {
                var tx = db.transaction("probe", "readwrite");
                var store = tx.objectStore("probe");
                store.put("ok", "probe");
                tx.oncomplete = function() {
                    cleanup();
                    done({ supported: true, mode: "readwrite", details: metadata });
                };
                tx.onerror = function(event) {
                    cleanup();
                    var error = event && event.target ? event.target.error : null;
                    done({ supported: true, mode: "readonly", error: error, details: metadata });
                };
            } catch (error) {
                cleanup();
                done({ supported: true, mode: "blocked", error: error, details: metadata });
            }
        };
    });
}

async function probeFileSystemAccess(context) {
    var global = getGlobalObject();
    var hasOpen = global && typeof global.showOpenFilePicker === "function";
    var hasSave = global && typeof global.showSaveFilePicker === "function";
    var hasDirectory = global && (typeof global.showDirectoryPicker === "function" || typeof global.chooseFileSystemEntries === "function");
    var accessHandle = global && global.FileSystemFileHandle && global.FileSystemFileHandle.prototype
        && typeof global.FileSystemFileHandle.prototype.createWritable === "function";
    if (!hasOpen && !hasSave && !hasDirectory) {
        return { supported: false, mode: "unsupported" };
    }
    return {
        supported: true,
        mode: "blocked",
        details: {
            showOpenFilePicker: !!hasOpen,
            showSaveFilePicker: !!hasSave,
            showDirectoryPicker: !!hasDirectory,
            writableHandles: !!accessHandle,
        },
        note: "User gesture required to verify browser File System Access API",
    };
}

async function probeOPFS(context) {
    if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.getDirectory !== "function") {
        return { supported: false, mode: "unsupported" };
    }
    var dirName = PROBE_PREFIX + "opfs" + Math.random().toString(36).slice(2);
    try {
        var root = await navigator.storage.getDirectory();
        if (!root) {
            return { supported: true, mode: "blocked", error: { name: "NotAvailableError", message: "OPFS root not available" } };
        }
        var dir = await root.getDirectoryHandle(dirName, { create: true });
        try {
            var file = await dir.getFileHandle("probe.txt", { create: true });
            var writable = await file.createWritable();
            await writable.write("ok");
            await writable.close();
            if (typeof dir.removeEntry === "function") {
                try { await dir.removeEntry("probe.txt"); } catch (_) {}
            }
            if (typeof root.removeEntry === "function") {
                try { await root.removeEntry(dirName, { recursive: true }); } catch (_) {}
            }
            return { supported: true, mode: "readwrite" };
        } catch (error) {
            if (typeof root.removeEntry === "function") {
                try { await root.removeEntry(dirName, { recursive: true }); } catch (_) {}
            }
            return {
                supported: true,
                mode: error && error.name === "NotAllowedError" ? "blocked" : "readonly",
                error: error,
            };
        }
    } catch (error) {
        return {
            supported: error && error.name === "SecurityError" ? false : true,
            mode: "blocked",
            error: error,
        };
    }
}

const DEFAULT_PROBES = [
    { name: "indexedDB", probe: probeIndexedDB },
    { name: "cacheStorage", probe: probeCacheStorage },
    { name: "opfs", probe: probeOPFS },
    { name: "fileSystemAccess", probe: probeFileSystemAccess },
    { name: "localStorage", probe: probeLocalStorage },
];

async function performDetection(options) {
    options = options || {};
    var start = nowMs();
    var totalTimeout = options.timeoutMs;
    if (typeof totalTimeout !== "number" || !isFinite(totalTimeout)) totalTimeout = DEFAULT_TOTAL_TIMEOUT_MS;
    if (totalTimeout < 0) totalTimeout = 0;
    var deadline = totalTimeout > 0 ? (start + totalTimeout) : null;
    var perProbeTimeout = typeof options.perProbeTimeoutMs === "number" && options.perProbeTimeoutMs >= 0
        ? options.perProbeTimeoutMs
        : null;
    var signal = options.abortSignal || options.signal || null;
    var report = {
        timestamp: toISOString(Date.now()),
        origin: (typeof location !== "undefined" && location && location.origin) ? location.origin : null,
        probes: {},
        durationMs: 0,
        errors: [],
    };
    var probes = Array.isArray(options.probes) && options.probes.length
        ? options.probes
        : DEFAULT_PROBES;
    for (var i = 0; i < probes.length; i++) {
        var descriptor = probes[i];
        if (!descriptor) continue;
        var name = typeof descriptor.name === "string" && descriptor.name ? descriptor.name : "probe-" + i;
        var fn = typeof descriptor.probe === "function" ? descriptor.probe : (typeof descriptor === "function" ? descriptor : null);
        if (typeof fn !== "function") continue;
        var now = nowMs();
        if (deadline && now >= deadline) {
            var timeoutError = createTimeoutError(name);
            report.errors.push(formatError(timeoutError));
            break;
        }
        var remaining = deadline ? Math.max(0, deadline - now) : null;
        var budget = perProbeTimeout != null
            ? (remaining != null ? Math.min(perProbeTimeout, remaining) : perProbeTimeout)
            : remaining;
        if (budget !== null && (!isFinite(budget) || budget <= 0)) budget = null;
        var probeStart = nowMs();
        var context = {
            abortSignal: signal,
            signal: signal,
            timeoutMs: budget,
            deadline: deadline,
            timeRemaining: function() {
                if (deadline == null) return Infinity;
                var rem = deadline - nowMs();
                return rem > 0 ? rem : 0;
            },
            previousReport: cachedReport,
        };
        var value;
        try {
            value = await runWithAbort(function() {
                return fn(context);
            }, signal, budget, function() { return createTimeoutError(name); }, name);
        } catch (error) {
            var formattedError = formatError(error);
            if (formattedError) {
                var annotatedError = Object.assign({ probe: name }, formattedError);
                report.errors.push(annotatedError);
            }
            value = {
                supported: false,
                mode: error && error.name === "AbortError" ? "blocked" : "unknown",
                error: error,
            };
            if (error && error.name === "AbortError") {
                report.probes[name] = normalizeProbeResult(Object.assign({}, value, {
                    durationMs: nowMs() - probeStart,
                }));
                break;
            }
        }
        var normalized = normalizeProbeResult(Object.assign({}, value, {
            durationMs: nowMs() - probeStart,
        }));
        report.probes[name] = normalized;
    }
    report.durationMs = nowMs() - start;
    return report;
}

export function getStorageCapabilityReport() {
    return cachedReport;
}

export function setStorageCapabilityReport(report) {
    return recordReport(report);
}

export function detectStorageCapabilities(options) {
    if (pendingDetection) return pendingDetection;
    updatePendingState(true);
    var detection = performDetection(options).then(function(report) {
        recordDetectionError(null);
        recordReport(report);
        emitTelemetry(report);
        return report;
    }).catch(function(error) {
        recordDetectionError(error);
        throw error;
    });
    pendingDetection = detection.finally(function() {
        updatePendingState(false);
        if (pendingDetection === detection) pendingDetection = null;
    });
    return pendingDetection;
}

export function ensureStorageCapabilityReport(options) {
    options = options || {};
    if (options.report !== undefined) {
        return Promise.resolve(recordReport(options.report));
    }
    if (cachedReport && options.force !== true) {
        return Promise.resolve(cachedReport);
    }
    if (pendingDetection) return pendingDetection;
    return detectStorageCapabilities(options);
}

function ensureGlobalAPI() {
    var global = getGlobalObject();
    if (!global) return;
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.Storage) global.Squeak.Storage = {};
    if (!global.Squeak.Storage.Capabilities) global.Squeak.Storage.Capabilities = {};
    Object.assign(global.Squeak.Storage.Capabilities, {
        detect: detectStorageCapabilities,
        ensure: ensureStorageCapabilityReport,
        getReport: getStorageCapabilityReport,
        setReport: setStorageCapabilityReport,
    });
}

ensureGlobalAPI();

