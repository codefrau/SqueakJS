"use strict";

const DEFAULT_THRESHOLDS = {
    notice: 0.5,
    warning: 0.75,
    critical: 0.9,
};

const DEFAULT_POLL_INTERVAL_MS = 30000;
const HISTORY_LIMIT = 20;

const state = {
    monitorStarted: false,
    pollInterval: DEFAULT_POLL_INTERVAL_MS,
    thresholds: Object.assign({}, DEFAULT_THRESHOLDS),
    history: [],
    events: [],
    listeners: [],
    warningSemaphore: null,
    evictionHandler: null,
    evictionInFlight: false,
    lastLevels: {},
    manifestSummary: {
        totalBytes: 0,
        fileCount: 0,
        files: {},
        updatedAt: null,
    },
    supported: false,
    storageEstimateSupported: false,
    lastEstimate: null,
    pendingTimer: null,
    sampleInFlight: null,
    lastError: null,
    lastEviction: null,
};

function getGlobalObject() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return {};
}

function ensureQuotaNamespace() {
    const global = getGlobalObject();
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.StorageQuota || typeof global.Squeak.StorageQuota !== "object") {
        global.Squeak.StorageQuota = {};
    }
    return global.Squeak.StorageQuota;
}

function cloneThresholds(thresholds) {
    const result = Object.assign({}, DEFAULT_THRESHOLDS);
    if (thresholds && typeof thresholds === "object") {
        ["notice", "warning", "critical"].forEach(function(level) {
            const value = thresholds[level];
            if (typeof value === "number" && isFinite(value) && value > 0) {
                result[level] = Math.max(0, Math.min(1, value));
            }
        });
    }
    return result;
}

function setThresholds(thresholds) {
    state.thresholds = cloneThresholds(thresholds);
    return state.thresholds;
}

function setPollInterval(pollIntervalMs) {
    if (typeof pollIntervalMs === "number" && isFinite(pollIntervalMs) && pollIntervalMs >= 0) {
        state.pollInterval = pollIntervalMs;
    }
    return state.pollInterval;
}

function clearPendingTimer() {
    if (state.pendingTimer) {
        clearTimeout(state.pendingTimer);
        state.pendingTimer = null;
    }
}

function scheduleNextSample(delayMs) {
    clearPendingTimer();
    const delay = typeof delayMs === "number" && delayMs >= 0 ? delayMs : state.pollInterval;
    if (!delay || delay <= 0) {
        return;
    }
    state.pendingTimer = setTimeout(function() {
        state.pendingTimer = null;
        forceSample();
    }, delay);
}

function normalizeEstimate(estimate, manifestSummary) {
    const usage = typeof estimate.usage === "number" && estimate.usage >= 0
        ? estimate.usage
        : manifestSummary.totalBytes;
    const quota = typeof estimate.quota === "number" && estimate.quota > 0
        ? estimate.quota
        : (state.lastEstimate && typeof state.lastEstimate.quota === "number" && state.lastEstimate.quota > 0
            ? state.lastEstimate.quota
            : Math.max(usage, manifestSummary.totalBytes || 0));
    return {
        usage,
        quota,
        persisted: !!estimate.persisted,
    };
}

function summarizeManifest(manifest) {
    if (!manifest || typeof manifest !== "object") {
        return {
            totalBytes: 0,
            fileCount: 0,
            files: {},
            updatedAt: null,
        };
    }
    const files = manifest.files && typeof manifest.files === "object"
        ? manifest.files
        : {};
    const fileCount = Object.keys(files).length;
    const totalBytes = typeof manifest.totalBytes === "number" && manifest.totalBytes >= 0
        ? manifest.totalBytes
        : Object.keys(files).reduce(function(sum, key) {
            const entry = files[key] || {};
            return sum + (entry.size && entry.size > 0 ? entry.size : 0);
        }, 0);
    return {
        totalBytes,
        fileCount,
        files,
        updatedAt: manifest.updatedAt || Date.now(),
    };
}

function recordHistory(sample) {
    state.history.push(sample);
    while (state.history.length > HISTORY_LIMIT) {
        state.history.shift();
    }
}

function enqueueEvent(event) {
    if (!event) return;
    state.events.push(event);
    state.listeners.forEach(function(listener) {
        try { listener(event); } catch (_) {}
    });
    signalWarningSemaphore();
}

function signalWarningSemaphore() {
    if (!state.warningSemaphore) return;
    const global = getGlobalObject();
    const squeak = global.Squeak;
    if (!squeak || !squeak.vm || !squeak.vm.primHandler ||
        typeof squeak.vm.primHandler.signalSemaphoreWithIndex !== "function") {
        return;
    }
    try {
        squeak.vm.primHandler.signalSemaphoreWithIndex(state.warningSemaphore);
    } catch (_) {}
}

function classifyFilePriority(path) {
    if (!path || typeof path !== "string") return 5;
    const lower = path.toLowerCase();
    if (lower.endsWith(".image") || lower.endsWith(".changes") || lower.endsWith(".sources")) return 0;
    if (lower.endsWith(".project") || lower.endsWith(".mcz") || lower.endsWith(".sar")) return 1;
    if (lower.endsWith(".log") || lower.endsWith(".txt")) return 2;
    if (lower.endsWith(".json") || lower.endsWith(".js")) return 3;
    return 4;
}

function planEviction(estimate, manifestSummary) {
    if (!state.evictionHandler || !manifestSummary || manifestSummary.fileCount === 0) {
        return null;
    }
    const percentUsed = estimate.quota > 0 ? estimate.usage / estimate.quota : 0;
    if (percentUsed < state.thresholds.critical) {
        return null;
    }
    const targetBytes = Math.min(
        estimate.usage,
        Math.max(estimate.usage - estimate.quota * 0.7, estimate.quota * 0.1)
    );
    const entries = Object.keys(manifestSummary.files).map(function(path) {
        const meta = manifestSummary.files[path] || {};
        return {
            path: path,
            size: typeof meta.size === "number" && meta.size > 0 ? meta.size : 0,
            updatedAt: typeof meta.updatedAt === "number" ? meta.updatedAt : 0,
            priority: classifyFilePriority(path),
        };
    });
    entries.sort(function(a, b) {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.updatedAt - b.updatedAt;
    });
    let reclaimed = 0;
    const selected = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.priority <= 0) continue;
        selected.push(entry.path);
        reclaimed += entry.size;
        if (reclaimed >= targetBytes) break;
    }
    if (!selected.length) {
        return null;
    }
    return {
        targetBytes,
        reclaimedEstimate: reclaimed,
        paths: selected,
        percentUsed,
    };
}

function maybeTriggerEviction(estimate, manifestSummary) {
    if (state.evictionInFlight || !state.evictionHandler) return;
    const plan = planEviction(estimate, manifestSummary);
    if (!plan) return;
    state.evictionInFlight = true;
    const result = state.evictionHandler(plan.paths, {
        targetBytes: plan.targetBytes,
        reclaimedEstimate: plan.reclaimedEstimate,
        percentUsed: plan.percentUsed,
    });
    state.lastEviction = {
        requestedAt: Date.now(),
        plan,
    };
    Promise.resolve(result).catch(function(error) {
        state.lastError = formatError(error);
    }).finally(function() {
        state.evictionInFlight = false;
    });
    enqueueEvent({
        type: "eviction-request",
        paths: plan.paths.slice(0),
        targetBytes: plan.targetBytes,
        reclaimedEstimate: plan.reclaimedEstimate,
        percentUsed: plan.percentUsed,
        timestamp: Date.now(),
    });
}

function recordEvictionResult(result) {
    const entry = Object.assign({ completedAt: Date.now() }, result || {});
    state.lastEviction = Object.assign({}, state.lastEviction, { result: entry, completedAt: entry.completedAt });
    enqueueEvent({
        type: "eviction-result",
        result: entry,
        timestamp: entry.completedAt,
    });
}

function formatError(error) {
    if (!error) return null;
    if (typeof error === "string") {
        return { name: "Error", message: error };
    }
    const formatted = {
        name: error && error.name ? error.name : "Error",
        message: error && error.message ? error.message : String(error),
    };
    if (error.code !== undefined) formatted.code = error.code;
    if (error.type !== undefined) formatted.type = error.type;
    if (error.reason !== undefined) formatted.reason = error.reason;
    return formatted;
}

function evaluateThresholds(sample) {
    const percentUsed = sample.percentUsed;
    const triggeredLevels = [];
    Object.keys(state.thresholds).forEach(function(level) {
        const threshold = state.thresholds[level];
        if (typeof threshold !== "number") return;
        const previously = state.lastLevels[level] || 0;
        if (percentUsed >= threshold && previously < threshold) {
            state.lastLevels[level] = percentUsed;
            triggeredLevels.push(level);
        } else if (percentUsed < threshold * 0.9) {
            state.lastLevels[level] = percentUsed;
        }
    });
    triggeredLevels.forEach(function(level) {
        enqueueEvent({
            type: "threshold", level: level,
            percentUsed: sample.percentUsed,
            usage: sample.usage,
            quota: sample.quota,
            cacheBytes: sample.cacheBytes,
            timestamp: sample.timestamp,
        });
    });
}

function processEstimate(estimate, manifestSummary) {
    const now = Date.now();
    const sample = {
        timestamp: now,
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: estimate.quota > 0 ? estimate.usage / estimate.quota : 0,
        cacheBytes: manifestSummary.totalBytes,
        fileCount: manifestSummary.fileCount,
        persisted: !!estimate.persisted,
    };
    state.lastEstimate = sample;
    recordHistory(sample);
    evaluateThresholds(sample);
    maybeTriggerEviction(estimate, manifestSummary);
    return sample;
}

function ensureEstimateSupport() {
    const global = getGlobalObject();
    const navigatorObj = global.navigator;
    state.storageEstimateSupported = !!(navigatorObj && navigatorObj.storage && typeof navigatorObj.storage.estimate === "function");
    return state.storageEstimateSupported;
}

function ensureMonitor(options) {
    options = options || {};
    if (options.thresholds) setThresholds(options.thresholds);
    if (options.pollInterval !== undefined) setPollInterval(options.pollInterval);
    ensureEstimateSupport();
    state.monitorStarted = true;
    if (options.listener && typeof options.listener === "function") {
        registerListener(options.listener);
    }
    if (options.autoSample !== false) {
        if (options.immediate !== false) {
            forceSample();
        }
        if (state.pollInterval > 0) {
            scheduleNextSample(state.pollInterval);
        }
    }
    return getState();
}

function registerListener(listener) {
    if (typeof listener === "function") {
        state.listeners.push(listener);
    }
    return function unsubscribe() {
        const index = state.listeners.indexOf(listener);
        if (index !== -1) state.listeners.splice(index, 1);
    };
}

function setWarningSemaphore(index) {
    if (typeof index === "number" && index > 0) {
        state.warningSemaphore = index;
        return index;
    }
    state.warningSemaphore = null;
    return null;
}

function updateManifest(manifest) {
    state.manifestSummary = summarizeManifest(manifest);
}

function setVFSSupport(supported) {
    state.supported = !!supported;
}

function setEvictionHandler(handler) {
    if (typeof handler === "function") {
        state.evictionHandler = handler;
    } else {
        state.evictionHandler = null;
    }
}

function drainEvents() {
    const drained = state.events.splice(0, state.events.length);
    return drained;
}

function getState() {
    return {
        monitorStarted: state.monitorStarted,
        thresholds: Object.assign({}, state.thresholds),
        pollInterval: state.pollInterval,
        history: state.history.slice(0),
        events: state.events.slice(0),
        lastEstimate: state.lastEstimate,
        manifest: Object.assign({}, state.manifestSummary),
        supported: state.supported,
        storageEstimateSupported: state.storageEstimateSupported,
        lastError: state.lastError,
        lastEviction: state.lastEviction,
    };
}

function forceSample() {
    if (state.sampleInFlight) return state.sampleInFlight;
    ensureEstimateSupport();
    const manifestSummary = state.manifestSummary;
    const global = getGlobalObject();
    const navigatorObj = global.navigator;
    let estimatePromise;
    if (state.storageEstimateSupported) {
        try {
            estimatePromise = Promise.resolve(navigatorObj.storage.estimate());
        } catch (error) {
            state.lastError = formatError(error);
            estimatePromise = Promise.resolve({ usage: manifestSummary.totalBytes, quota: manifestSummary.totalBytes });
        }
    } else {
        estimatePromise = Promise.resolve({ usage: manifestSummary.totalBytes, quota: manifestSummary.totalBytes });
    }
    state.sampleInFlight = estimatePromise.then(function(estimate) {
        const normalized = normalizeEstimate(estimate || {}, manifestSummary);
        const sample = processEstimate(normalized, manifestSummary);
        return sample;
    }).catch(function(error) {
        state.lastError = formatError(error);
        const fallback = normalizeEstimate({}, manifestSummary);
        return processEstimate(fallback, manifestSummary);
    }).finally(function() {
        state.sampleInFlight = null;
        if (state.pollInterval > 0 && !state.pendingTimer) {
            scheduleNextSample(state.pollInterval);
        }
    });
    return state.sampleInFlight;
}

function drainEventsAsJSON() {
    const events = drainEvents();
    try {
        return JSON.stringify(events);
    } catch (_) {
        return "[]";
    }
}

const namespace = ensureQuotaNamespace();
namespace.ensureMonitor = ensureMonitor;
namespace.getState = getState;
namespace.forceSample = forceSample;
namespace.drainEvents = drainEvents;
namespace.setWarningSemaphore = setWarningSemaphore;
namespace.updateManifest = updateManifest;
namespace.setVFSSupport = setVFSSupport;
namespace.setEvictionHandler = setEvictionHandler;
namespace.recordEvictionResult = recordEvictionResult;

export {
    ensureMonitor as ensureStorageQuotaMonitor,
    getState as getStorageQuotaState,
    forceSample as forceStorageQuotaSample,
    drainEvents as drainStorageQuotaEvents,
    drainEventsAsJSON,
    setWarningSemaphore as setStorageQuotaWarningSemaphore,
    updateManifest as updateStorageQuotaManifest,
    setVFSSupport as setStorageQuotaVFSSupport,
    setEvictionHandler as setStorageQuotaEvictionHandler,
    recordEvictionResult as recordStorageQuotaEvictionResult,
};

