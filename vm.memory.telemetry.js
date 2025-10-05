"use strict";

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_MAX_SAMPLES = 120;
const DEFAULT_LOG_EVERY = 30;
const DEFAULT_LOW_SPACE_MULTIPLE = 2;
const DEFAULT_FREE_WARN_RATIO = 0.1;
const DEFAULT_FREE_CRITICAL_RATIO = 0.04;
const DEFAULT_HEAP_WARN_RATIO = 0.8;
const DEFAULT_HEAP_CRITICAL_RATIO = 0.9;

function parseNumber(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim()) {
        var parsed = Number(value);
        return isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
}

function nonNegative(value, fallback) {
    var parsed = parseNumber(value);
    if (!isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
}

function atLeastOne(value, fallback) {
    var parsed = parseNumber(value);
    if (!isFinite(parsed) || parsed < 1) return fallback;
    return Math.round(parsed);
}

function ratioOr(value, fallback) {
    var parsed = parseNumber(value);
    if (!isFinite(parsed)) return fallback;
    if (parsed < 0) return 0;
    if (parsed > 1) return 1;
    return parsed;
}

function positiveOr(value, fallback, minimum) {
    var parsed = parseNumber(value);
    if (!isFinite(parsed) || parsed < (minimum || 0)) return fallback;
    return parsed;
}

function extractRawTelemetryOptions(options) {
    if (!options || typeof options !== "object") return undefined;
    var candidates = [];
    if (options.memoryTelemetry !== undefined) candidates.push(options.memoryTelemetry);
    if (options.memory && typeof options.memory === "object" && options.memory.telemetry !== undefined) {
        candidates.push(options.memory.telemetry);
    }
    if (options.telemetry && typeof options.telemetry === "object" && options.telemetry.memory !== undefined) {
        candidates.push(options.telemetry.memory);
    }
    if (options.vm && typeof options.vm === "object") {
        var vmOptions = options.vm;
        if (vmOptions.memoryTelemetry !== undefined) candidates.push(vmOptions.memoryTelemetry);
        if (vmOptions.memory && typeof vmOptions.memory === "object" && vmOptions.memory.telemetry !== undefined) {
            candidates.push(vmOptions.memory.telemetry);
        }
        if (vmOptions.telemetry && typeof vmOptions.telemetry === "object" && vmOptions.telemetry.memory !== undefined) {
            candidates.push(vmOptions.telemetry.memory);
        }
    }
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] !== undefined) return candidates[i];
    }
    return undefined;
}

function normalizeTelemetryConfig(options) {
    var raw = extractRawTelemetryOptions(options);
    if (raw === false) {
        return { enabled: false };
    }
    var source = raw;
    if (source === undefined || source === true) {
        source = {};
    } else if (typeof source === "number") {
        source = { intervalMs: source };
    } else if (typeof source === "string" && source.trim()) {
        var parsed = Number(source);
        source = isFinite(parsed) ? { intervalMs: parsed } : {};
    } else if (!source || typeof source !== "object") {
        source = {};
    }
    var intervalMs = nonNegative(source.intervalMs, DEFAULT_INTERVAL_MS);
    var maxSamples = atLeastOne(source.maxSamples, DEFAULT_MAX_SAMPLES);
    var logEvery = nonNegative(source.logEvery, DEFAULT_LOG_EVERY);
    var lowSpaceWarnMultiple = positiveOr(source.lowSpaceWarnMultiple, DEFAULT_LOW_SPACE_MULTIPLE, 1);
    var freeWarnRatio = ratioOr(source.freeWarnRatio, DEFAULT_FREE_WARN_RATIO);
    var freeCriticalRatio = ratioOr(source.freeCriticalRatio, DEFAULT_FREE_CRITICAL_RATIO);
    var heapWarnRatio = ratioOr(source.heapWarnRatio, DEFAULT_HEAP_WARN_RATIO);
    var heapCriticalRatio = ratioOr(source.heapCriticalRatio, DEFAULT_HEAP_CRITICAL_RATIO);
    if (heapCriticalRatio < heapWarnRatio) heapCriticalRatio = heapWarnRatio;
    if (freeCriticalRatio < freeWarnRatio / 2) freeCriticalRatio = freeWarnRatio / 2;
    return {
        enabled: true,
        intervalMs: intervalMs,
        maxSamples: maxSamples,
        logEvery: Math.round(logEvery),
        lowSpaceWarnMultiple: lowSpaceWarnMultiple,
        freeWarnRatio: freeWarnRatio,
        freeCriticalRatio: freeCriticalRatio,
        heapWarnRatio: heapWarnRatio,
        heapCriticalRatio: heapCriticalRatio,
    };
}

function formatMB(bytes) {
    if (!isFinite(bytes)) return "0";
    return (bytes / 1000000).toFixed(1);
}

function logSnapshot(snapshot, sampleCount) {
    if (typeof console === "undefined" || typeof console.log !== "function") return;
    var total = isFinite(snapshot.totalBytes) ? snapshot.totalBytes : 0;
    var used = isFinite(snapshot.usedBytes) ? snapshot.usedBytes : 0;
    var free = isFinite(snapshot.freeBytes) ? snapshot.freeBytes : Math.max(0, total - used);
    var host = snapshot.host || {};
    var hostRatio = (typeof host.usedJSHeapSize === "number" && typeof host.jsHeapSizeLimit === "number" && host.jsHeapSizeLimit > 0)
        ? (host.usedJSHeapSize / host.jsHeapSizeLimit) * 100
        : null;
    var parts = [
        "[SqueakJS][memory]",
        "samples=" + sampleCount,
        "total=" + formatMB(total) + "MB",
        "used=" + formatMB(used) + "MB",
        "free=" + formatMB(free) + "MB",
    ];
    if (hostRatio !== null) {
        parts.push("hostHeap=" + hostRatio.toFixed(1) + "%");
    }
    console.log(parts.join(" "));
}

function checkWarnings(snapshot, state, config) {
    if (typeof console === "undefined" || typeof console.warn !== "function") return;
    var total = isFinite(snapshot.totalBytes) ? snapshot.totalBytes : 0;
    var free = isFinite(snapshot.freeBytes) ? snapshot.freeBytes : 0;
    var policy = snapshot.policy || {};
    var lowSpace = (typeof policy.lowSpaceBytes === "number" && isFinite(policy.lowSpaceBytes)) ? policy.lowSpaceBytes : 0;
    var level = 0;
    if (lowSpace > 0) {
        if (free <= lowSpace) level = 2;
        else if (free <= lowSpace * config.lowSpaceWarnMultiple) level = 1;
    } else if (total > 0) {
        var ratio = total > 0 ? free / total : 1;
        if (ratio <= config.freeCriticalRatio) level = 2;
        else if (ratio <= config.freeWarnRatio) level = 1;
    }
    if (level > state.lastWarningLevels.lowSpace) {
        var message = "[SqueakJS][memory] low memory: free=" + formatMB(free) + "MB of " + formatMB(total) + "MB remaining";
        if (lowSpace > 0) {
            message += " (threshold " + formatMB(lowSpace) + "MB)";
        }
        console.warn(message);
    }
    state.lastWarningLevels.lowSpace = level;

    var host = snapshot.host || {};
    var hostLevel = 0;
    if (typeof host.jsHeapSizeLimit === "number" && isFinite(host.jsHeapSizeLimit) && host.jsHeapSizeLimit > 0 &&
        typeof host.usedJSHeapSize === "number" && isFinite(host.usedJSHeapSize)) {
        var hostRatio = host.usedJSHeapSize / host.jsHeapSizeLimit;
        if (hostRatio >= config.heapCriticalRatio) hostLevel = 2;
        else if (hostRatio >= config.heapWarnRatio) hostLevel = 1;
        if (hostLevel > state.lastWarningLevels.hostHeap) {
            console.warn("[SqueakJS][memory] host heap usage at " + Math.round(hostRatio * 100) + "% (" +
                formatMB(host.usedJSHeapSize) + "MB of " + formatMB(host.jsHeapSizeLimit) + "MB)");
        }
    }
    state.lastWarningLevels.hostHeap = hostLevel;
}

export function startMemoryTelemetry(vm, options) {
    if (!vm || !vm.image) return null;
    var config = normalizeTelemetryConfig(options || vm.options || {});
    if (!config.enabled) {
        var disabledState = vm.image.memoryTelemetry || { history: [], enabled: false };
        disabledState.enabled = false;
        vm.image.memoryTelemetry = disabledState;
        vm.memoryTelemetry = disabledState;
        return disabledState;
    }
    if (vm.image.memoryTelemetry && typeof vm.image.memoryTelemetry.stop === "function") {
        vm.image.memoryTelemetry.stop();
    }
    var history = [];
    var state = {
        enabled: true,
        config: config,
        history: history,
        sampleCount: 0,
        timer: null,
        lastWarningLevels: { lowSpace: 0, hostHeap: 0 },
        sample: null,
        stop: function() {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        },
        latest: function() {
            return history.length ? history[history.length - 1] : null;
        },
        latestArray: function() {
            var latest = this.latest();
            return latest ? vm.image.memorySnapshotToArray(latest) : null;
        },
        historyArrays: function() {
            return history.map(function(entry) {
                return vm.image.memorySnapshotToArray(entry);
            });
        },
    };

    function record(reason) {
        var snapshot = vm.image.captureMemorySnapshot(reason || "interval");
        history.push(snapshot);
        if (history.length > config.maxSamples) history.shift();
        state.sampleCount++;
        if (config.logEvery > 0 && state.sampleCount % config.logEvery === 0) {
            logSnapshot(snapshot, state.sampleCount);
        }
        checkWarnings(snapshot, state, config);
        return snapshot;
    }

    state.sample = record;

    if (config.intervalMs > 0 && typeof setInterval === "function") {
        state.timer = setInterval(function() {
            record("interval");
        }, config.intervalMs);
    }

    vm.image.memoryTelemetry = state;
    vm.memoryTelemetry = state;

    record("startup");

    return state;
}

export function getMemoryTelemetryState(vm) {
    return vm && vm.image ? vm.image.memoryTelemetry || null : null;
}

export function recordMemoryTelemetrySample(vm, reason) {
    if (!vm || !vm.image) return null;
    var telemetry = vm.image.memoryTelemetry;
    if (telemetry && typeof telemetry.sample === "function") {
        return telemetry.sample(reason || "manual");
    }
    return vm.image.captureMemorySnapshot(reason || "manual");
}

export function stopMemoryTelemetry(vm) {
    if (!vm || !vm.image) return;
    var telemetry = vm.image.memoryTelemetry;
    if (telemetry && typeof telemetry.stop === "function") {
        telemetry.stop();
    }
}
