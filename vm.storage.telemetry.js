"use strict";

const STORAGE_PREFIX = "[SqueakJS][storage]";

let lastCapabilitySignature = null;

function getGlobalObject() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return {};
}

function getTelemetryEmitter() {
    const global = getGlobalObject();
    const squeak = global && global.Squeak;
    const telemetry = squeak && squeakHasTelemetry(squeak) ? squeak.telemetry : null;
    return telemetry && typeof telemetry.emit === "function" ? telemetry : null;
}

function squeakHasTelemetry(squeak) {
    return squeak && typeof squeak.telemetry === "object";
}

function ensureNamespace() {
    const global = getGlobalObject();
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.StorageTelemetry || typeof global.Squeak.StorageTelemetry !== "object") {
        global.Squeak.StorageTelemetry = {};
    }
    return global.Squeak.StorageTelemetry;
}

function logToConsole(level, message, payload) {
    if (typeof console === "undefined") return;
    const logger = console[level] || console.log;
    if (typeof logger !== "function") return;
    try {
        if (payload !== undefined) {
            logger.call(console, message, payload);
        } else {
            logger.call(console, message);
        }
    } catch (_) {}
}

function emit(eventName, payload, fallbackLevel) {
    const emitter = getTelemetryEmitter();
    if (emitter) {
        try {
            emitter.emit(eventName, payload);
            return true;
        } catch (error) {
            logToConsole("warn", `${STORAGE_PREFIX} telemetry emit failed (${eventName})`, {
                error: formatError(error),
            });
        }
    }
    logToConsole(fallbackLevel || "info", `${STORAGE_PREFIX} ${eventName}`, payload);
    return false;
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

function emitStorageCapabilityTelemetry(report) {
    if (!report || typeof report !== "object") return false;
    let signature = null;
    try {
        signature = JSON.stringify({ origin: report.origin || null, probes: report.probes || null });
    } catch (_) {}
    if (signature && signature === lastCapabilitySignature) {
        return false;
    }
    if (signature) lastCapabilitySignature = signature;
    return emit("storage.capability", report, "info");
}

function emitStorageQuotaSampleTelemetry(sample) {
    if (!sample || typeof sample !== "object") return false;
    const payload = Object.assign({
        type: "sample",
    }, sample);
    return emit("storage.quota.sample", payload, "info");
}

function emitStorageQuotaEventTelemetry(event) {
    if (!event || typeof event !== "object") return false;
    const payload = Object.assign({
        type: event.type || "event",
    }, event);
    const level = event.level === "critical" ? "warn" : "info";
    return emit("storage.quota.event", payload, level);
}

function emitStorageErrorTelemetry(error, context) {
    if (!error && !context) return false;
    const payload = Object.assign({
        type: "error",
        error: formatError(error),
    }, context || {});
    return emit("storage.error", payload, "warn");
}

function emitStorageReconciliationTelemetry(report) {
    if (!report || typeof report !== "object") return false;
    const payload = Object.assign({
        type: "reconciliation",
    }, report);
    const hasIssues = Array.isArray(report.issues) && report.issues.length > 0;
    return emit("storage.reconciliation", payload, hasIssues ? "warn" : "info");
}

function __resetStorageTelemetryForTests() {
    lastCapabilitySignature = null;
}

const namespace = ensureNamespace();

Object.assign(namespace, {
    emitCapability: emitStorageCapabilityTelemetry,
    emitQuotaSample: emitStorageQuotaSampleTelemetry,
    emitQuotaEvent: emitStorageQuotaEventTelemetry,
    emitError: emitStorageErrorTelemetry,
    emitReconciliation: emitStorageReconciliationTelemetry,
});

export {
    emitStorageCapabilityTelemetry,
    emitStorageQuotaSampleTelemetry,
    emitStorageQuotaEventTelemetry,
    emitStorageErrorTelemetry,
    emitStorageReconciliationTelemetry,
    __resetStorageTelemetryForTests,
};

