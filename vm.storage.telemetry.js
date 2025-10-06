"use strict";

import {
    configureTelemetryChannel,
    emitTelemetryEvent,
    resetTelemetryChannels,
    formatTelemetryError,
} from "./vm.telemetry.channel.js";

const STORAGE_PREFIX = "[SqueakJS][storage]";
const STORAGE_NAMESPACE = "storage";

const storageChannel = configureTelemetryChannel(STORAGE_NAMESPACE, {
    version: 1,
    bufferLimit: 180,
});

function ensureNamespace() {
    const global = (typeof globalThis !== "undefined") ? globalThis : (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : {})));
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.StorageTelemetry || typeof global.Squeak.StorageTelemetry !== "object") {
        global.Squeak.StorageTelemetry = {};
    }
    return global.Squeak.StorageTelemetry;
}

function emitStorageEvent(type, payload, options) {
    return emitTelemetryEvent(STORAGE_NAMESPACE, type, payload, Object.assign({
        eventName: options && options.eventName ? options.eventName : `storage.${type}`,
        fallbackLevel: options && options.fallbackLevel ? options.fallbackLevel : "info",
        consolePrefix: STORAGE_PREFIX,
        version: storageChannel.version,
    }, options));
}

function emitStorageCapabilityTelemetry(report) {
    if (!report || typeof report !== "object") return false;
    let signature = null;
    try {
        signature = JSON.stringify({ origin: report.origin || null, probes: report.probes || null });
    } catch (_) {
        signature = null;
    }
    return emitStorageEvent("capability", report, {
        eventName: "storage.capability",
        dedupeKey: signature,
        dedupeScope: "capability",
    });
}

function emitStorageQuotaSampleTelemetry(sample) {
    if (!sample || typeof sample !== "object") return false;
    const payload = Object.assign({
        type: "sample",
    }, sample);
    return emitStorageEvent("quota.sample", payload, {
        eventName: "storage.quota.sample",
    });
}

function emitStorageQuotaEventTelemetry(event) {
    if (!event || typeof event !== "object") return false;
    const payload = Object.assign({
        type: event.type || "event",
    }, event);
    const level = event.level === "critical" ? "warn" : "info";
    return emitStorageEvent("quota.event", payload, {
        eventName: "storage.quota.event",
        fallbackLevel: level,
    });
}

function emitStorageErrorTelemetry(error, context) {
    if (!error && !context) return false;
    const payload = Object.assign({
        type: "error",
        error: formatTelemetryError(error),
    }, context || {});
    return emitStorageEvent("error", payload, {
        eventName: "storage.error",
        fallbackLevel: "warn",
    });
}

function emitStorageReconciliationTelemetry(report) {
    if (!report || typeof report !== "object") return false;
    const payload = Object.assign({
        type: "reconciliation",
    }, report);
    const hasIssues = Array.isArray(report.issues) && report.issues.length > 0;
    return emitStorageEvent("reconciliation", payload, {
        eventName: "storage.reconciliation",
        fallbackLevel: hasIssues ? "warn" : "info",
    });
}

function __resetStorageTelemetryForTests() {
    resetTelemetryChannels(STORAGE_NAMESPACE);
}

const namespace = ensureNamespace();

Object.assign(namespace, {
    emitCapability: emitStorageCapabilityTelemetry,
    emitQuotaSample: emitStorageQuotaSampleTelemetry,
    emitQuotaEvent: emitStorageQuotaEventTelemetry,
    emitError: emitStorageErrorTelemetry,
    emitReconciliation: emitStorageReconciliationTelemetry,
    channel: storageChannel,
});

export {
    emitStorageCapabilityTelemetry,
    emitStorageQuotaSampleTelemetry,
    emitStorageQuotaEventTelemetry,
    emitStorageErrorTelemetry,
    emitStorageReconciliationTelemetry,
    __resetStorageTelemetryForTests,
};

