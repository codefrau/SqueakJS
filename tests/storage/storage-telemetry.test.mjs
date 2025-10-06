"use strict";

import assert from "assert";

function importFresh(modulePath) {
    const suffix = `?t=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return import(modulePath + suffix);
}

function installTelemetryRecorder(events) {
    const global = globalThis;
    const squeak = global.Squeak || (global.Squeak = {});
    const previousTelemetry = squeak.telemetry;
    squeak.telemetry = {
        emit(eventName, payload) {
            events.push({ eventName, payload });
        },
    };
    return function cleanup() {
        if (previousTelemetry) {
            squeak.telemetry = previousTelemetry;
        } else {
            delete squeak.telemetry;
            if (Object.keys(squeak).length === 0) {
                delete global.Squeak;
            }
        }
    };
}

function resetGlobals() {
    delete globalThis.navigator;
    delete globalThis.location;
    if (globalThis.Squeak && Object.keys(globalThis.Squeak).length === 0) {
        delete globalThis.Squeak;
    }
}

const telemetryModule = await import("../../vm.storage.telemetry.js");

async function verifyCapabilityTelemetry() {
    resetGlobals();
    const events = [];
    const cleanupTelemetry = installTelemetryRecorder(events);
    try {
        telemetryModule.__resetStorageTelemetryForTests();
        globalThis.location = { origin: "https://example.test" };
        const { setStorageCapabilityReport, detectStorageCapabilities } = await importFresh("../../vm.storage.capabilities.js");
        setStorageCapabilityReport(null);
        await detectStorageCapabilities({
            probes: [{
                name: "dummy",
                probe: async () => ({ supported: true, mode: "readwrite" }),
            }],
            timeoutMs: 20,
        });
        await detectStorageCapabilities({
            probes: [{
                name: "dummy",
                probe: async () => ({ supported: true, mode: "readwrite" }),
            }],
            timeoutMs: 20,
        });
    } finally {
        cleanupTelemetry();
    }
    const capabilityEvents = events.filter((entry) => entry.eventName === "storage.capability");
    assert.strictEqual(capabilityEvents.length, 1, "capability telemetry should dedupe identical reports");
    assert.strictEqual(
        capabilityEvents[0].payload.probes.dummy.mode,
        "readwrite",
        "payload should include normalized probe results"
    );
}

async function verifyQuotaSampleTelemetry() {
    resetGlobals();
    const events = [];
    const cleanupTelemetry = installTelemetryRecorder(events);
    try {
        telemetryModule.__resetStorageTelemetryForTests();
        const navigatorEstimate = async () => ({ usage: 4000, quota: 5000, persisted: true });
        globalThis.navigator = { storage: { estimate: navigatorEstimate } };
        const quotaModule = await importFresh("../../vm.storage.quota.js");
        const { ensureStorageQuotaMonitor, forceStorageQuotaSample, updateStorageQuotaManifest } = quotaModule;
        updateStorageQuotaManifest({
            totalBytes: 2048,
            fileCount: 2,
            files: {
                "test.image": { size: 1536, updatedAt: Date.now() - 5000 },
                "notes.txt": { size: 128, updatedAt: Date.now() - 1000 },
            },
            updatedAt: Date.now(),
        });
        ensureStorageQuotaMonitor({
            pollInterval: 0,
            autoSample: false,
            thresholds: { notice: 0.3, warning: 0.5, critical: 0.8 },
        });
        await forceStorageQuotaSample();
    } finally {
        cleanupTelemetry();
    }
    const sampleEvents = events.filter((entry) => entry.eventName === "storage.quota.sample");
    assert.strictEqual(sampleEvents.length, 1, "quota samples should emit telemetry once per force sample");
    const samplePayload = sampleEvents[0].payload;
    assert.strictEqual(samplePayload.usage, 4000, "sample payload should include usage");
    assert.strictEqual(samplePayload.quota, 5000, "sample payload should include quota");
    assert.strictEqual(samplePayload.manifestFileCount, 2, "sample payload should surface manifest counts");
    const thresholdEvents = events.filter((entry) => entry.eventName === "storage.quota.event" && entry.payload.type === "threshold");
    assert.ok(thresholdEvents.length > 0, "threshold crossing should emit quota events");
    assert.ok(thresholdEvents.some((event) => event.payload.level === "warning"), "warning threshold should trigger telemetry");
}

async function verifyQuotaErrorTelemetry() {
    resetGlobals();
    const events = [];
    const cleanupTelemetry = installTelemetryRecorder(events);
    try {
        telemetryModule.__resetStorageTelemetryForTests();
        globalThis.navigator = {
            storage: {
                estimate: async () => {
                    throw Object.assign(new Error("estimate failure"), { name: "AbortError" });
                },
            },
        };
        const quotaModule = await importFresh("../../vm.storage.quota.js");
        const { ensureStorageQuotaMonitor, forceStorageQuotaSample, updateStorageQuotaManifest } = quotaModule;
        updateStorageQuotaManifest({ totalBytes: 1024, fileCount: 0, files: {}, updatedAt: Date.now() });
        ensureStorageQuotaMonitor({ pollInterval: 0, autoSample: false });
        await forceStorageQuotaSample();
    } finally {
        cleanupTelemetry();
    }
    const errorEvents = events.filter((entry) => entry.eventName === "storage.error");
    assert.ok(errorEvents.length >= 1, "quota errors should emit telemetry events");
    assert.strictEqual(errorEvents[0].payload.scope, "storage.quota.estimate", "error payload should include scope");
    assert.strictEqual(errorEvents[0].payload.phase, "sample", "error payload should indicate failure phase");
    const sampleEvents = events.filter((entry) => entry.eventName === "storage.quota.sample");
    assert.strictEqual(sampleEvents.length, 1, "fallback sample should still emit telemetry after error");
}

await verifyCapabilityTelemetry();
await verifyQuotaSampleTelemetry();
await verifyQuotaErrorTelemetry();

const summary = {
    capabilityTelemetry: "ok",
    quotaSampleTelemetry: "ok",
    quotaErrorTelemetry: "ok",
};

console.log("Storage telemetry module verified", summary);

