"use strict";

const REPORT_VERSION = 1;

let cachedReport = null;
let pendingDetection = null;

function getGlobalObject(options) {
    if (options && options.global) return options.global;
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    return null;
}

function ensureBrowserState(globalObject) {
    var global = globalObject || getGlobalObject();
    if (!global) return null;
    if (!global.Squeak) global.Squeak = {};
    if (!global.Squeak.BrowserVMState || typeof global.Squeak.BrowserVMState !== "object") {
        global.Squeak.BrowserVMState = {};
    }
    return global.Squeak.BrowserVMState;
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
    var formatted = {
        name: typeof error.name === "string" && error.name ? error.name : "Error",
        message: typeof error.message === "string" && error.message ? error.message : String(error),
    };
    if (error.code !== undefined) formatted.code = error.code;
    if (error.type !== undefined && formatted.type === undefined) formatted.type = error.type;
    if (error.reason !== undefined && formatted.reason === undefined && typeof error.reason === "string") {
        formatted.reason = error.reason;
    }
    return formatted;
}

function normalizePermissionState(value) {
    if (!value && value !== "") return "unknown";
    var normalized = String(value).toLowerCase();
    if (normalized === "granted" || normalized === "denied" || normalized === "prompt") {
        return normalized;
    }
    return "unknown";
}

function hasFunction(object, name) {
    return !!(object && typeof object[name] === "function");
}

function createCapability(context, id, label) {
    var timestamp = toISOString(context.now());
    return {
        id: id,
        label: label,
        supported: false,
        permission: {
            state: "unknown",
            lastChecked: timestamp,
        },
        lastUpdated: timestamp,
    };
}

function ensurePermissionMetadata(permission, context) {
    if (!permission || typeof permission !== "object") {
        return {
            state: "unknown",
            lastChecked: toISOString(context.now()),
        };
    }
    var normalized = Object.assign({}, permission);
    if (!normalized.state) normalized.state = "unknown";
    if (!normalized.lastChecked) normalized.lastChecked = toISOString(context.now());
    return normalized;
}

async function queryPermission(context, descriptor, fallbackReason) {
    var navigatorObject = context.global && context.global.navigator ? context.global.navigator : null;
    var timestamp = toISOString(context.now());
    if (!navigatorObject || !navigatorObject.permissions ||
        typeof navigatorObject.permissions.query !== "function") {
        return {
            state: "unknown",
            lastChecked: timestamp,
            source: "static",
            reason: fallbackReason || "permissions-api-unavailable",
        };
    }
    try {
        var status = await navigatorObject.permissions.query(descriptor);
        var state = status && status.state ? normalizePermissionState(status.state) : "unknown";
        var result = {
            state: state,
            lastChecked: timestamp,
            source: "permissions",
        };
        if (status && status.state) result.raw = status.state;
        if (status && status.status) result.status = status.status;
        return result;
    } catch (error) {
        var formatted = formatError(error);
        var permission = {
            state: "unknown",
            lastChecked: timestamp,
            source: "permissions",
            error: formatted,
        };
        if (fallbackReason) permission.reason = fallbackReason;
        return permission;
    }
}

function finalizeCapability(capability, context) {
    if (!capability) return capability;
    capability.lastUpdated = capability.lastUpdated || toISOString(context.now());
    capability.supported = !!capability.supported;
    capability.permission = ensurePermissionMetadata(capability.permission, context);
    return capability;
}

async function detectAudioInput(context) {
    var capability = createCapability(context, "audio.input", "Microphone capture");
    var navigatorObject = context.global && context.global.navigator ? context.global.navigator : null;
    var mediaDevices = navigatorObject && navigatorObject.mediaDevices ? navigatorObject.mediaDevices : null;
    capability.supported = !!(mediaDevices && hasFunction(mediaDevices, "getUserMedia"));
    capability.requiresGesture = true;
    if (!capability.supported) {
        capability.reason = navigatorObject ? "media-devices-unavailable" : "navigator-unavailable";
    }
    capability.permission = await queryPermission(context, { name: "microphone" }, "permission-query-unsupported");
    return capability;
}

async function detectCamera(context) {
    var capability = createCapability(context, "video.camera", "Camera capture");
    var navigatorObject = context.global && context.global.navigator ? context.global.navigator : null;
    var mediaDevices = navigatorObject && navigatorObject.mediaDevices ? navigatorObject.mediaDevices : null;
    capability.supported = !!(mediaDevices && hasFunction(mediaDevices, "getUserMedia"));
    capability.requiresGesture = true;
    if (!capability.supported) {
        capability.reason = navigatorObject ? "media-devices-unavailable" : "navigator-unavailable";
    }
    capability.permission = await queryPermission(context, { name: "camera" }, "permission-query-unsupported");
    return capability;
}

async function detectAudioOutput(context) {
    var capability = createCapability(context, "audio.output", "Audio output");
    var globalObject = context.global;
    var navigatorObject = globalObject && globalObject.navigator ? globalObject.navigator : null;
    var mediaDevices = navigatorObject && navigatorObject.mediaDevices ? navigatorObject.mediaDevices : null;
    var hasAudioContext = typeof (globalObject && (globalObject.AudioContext || globalObject.webkitAudioContext)) === "function";
    var canEnumerate = mediaDevices && hasFunction(mediaDevices, "enumerateDevices");
    capability.supported = !!(hasAudioContext || canEnumerate);
    capability.details = {
        audioContext: !!hasAudioContext,
        enumerateDevices: !!canEnumerate,
    };
    if (!capability.supported) {
        capability.reason = navigatorObject ? "audio-output-unavailable" : "navigator-unavailable";
    }
    capability.permission = {
        state: "unknown",
        lastChecked: toISOString(context.now()),
        source: canEnumerate ? "device-enumeration" : "static",
        reason: canEnumerate ? "permission-required-to-enumerate" : "permission-not-exposed",
    };
    return capability;
}

async function detectClipboardRead(context) {
    var capability = createCapability(context, "clipboard.read", "Clipboard read");
    var navigatorObject = context.global && context.global.navigator ? context.global.navigator : null;
    var clipboard = navigatorObject && navigatorObject.clipboard ? navigatorObject.clipboard : null;
    capability.supported = !!(clipboard && hasFunction(clipboard, "readText"));
    capability.requiresGesture = true;
    if (!capability.supported) {
        capability.reason = navigatorObject ? "clipboard-api-unavailable" : "navigator-unavailable";
    }
    capability.permission = await queryPermission(context, { name: "clipboard-read" }, "permission-query-unsupported");
    return capability;
}

async function detectClipboardWrite(context) {
    var capability = createCapability(context, "clipboard.write", "Clipboard write");
    var navigatorObject = context.global && context.global.navigator ? context.global.navigator : null;
    var clipboard = navigatorObject && navigatorObject.clipboard ? navigatorObject.clipboard : null;
    capability.supported = !!(clipboard && hasFunction(clipboard, "writeText"));
    capability.requiresGesture = true;
    if (!capability.supported) {
        capability.reason = navigatorObject ? "clipboard-api-unavailable" : "navigator-unavailable";
    }
    capability.permission = await queryPermission(context, { name: "clipboard-write" }, "permission-query-unsupported");
    return capability;
}

async function detectFullscreen(context) {
    var capability = createCapability(context, "display.fullscreen", "Fullscreen");
    var documentObject = context.global && context.global.document ? context.global.document : null;
    var enabled = !!(documentObject && (documentObject.fullscreenEnabled || documentObject.webkitFullscreenEnabled));
    capability.supported = enabled;
    if (!enabled) {
        capability.reason = documentObject ? "fullscreen-disabled" : "document-unavailable";
    }
    capability.permission = {
        state: enabled ? "granted" : "unknown",
        lastChecked: toISOString(context.now()),
        source: "static",
        reason: enabled ? "no-permission-required" : "api-unavailable",
    };
    return capability;
}

async function detectPointerLock(context) {
    var capability = createCapability(context, "display.pointerLock", "Pointer lock");
    var documentObject = context.global && context.global.document ? context.global.document : null;
    var body = documentObject && documentObject.body ? documentObject.body : null;
    var supported = !!(body && (hasFunction(body, "requestPointerLock") || hasFunction(body, "webkitRequestPointerLock")));
    capability.supported = supported;
    capability.requiresGesture = true;
    if (!supported) {
        capability.reason = documentObject ? "pointer-lock-unavailable" : "document-unavailable";
    }
    capability.permission = {
        state: "unknown",
        lastChecked: toISOString(context.now()),
        source: "static",
        reason: supported ? "permission-request-determined-at-runtime" : "api-unavailable",
    };
    return capability;
}

async function detectNotifications(context) {
    var capability = createCapability(context, "notifications.default", "Notifications");
    var globalObject = context.global;
    var NotificationCtor = globalObject && globalObject.Notification ? globalObject.Notification : null;
    capability.supported = typeof NotificationCtor === "function" || typeof NotificationCtor === "object";
    if (!capability.supported) {
        capability.reason = "notification-api-unavailable";
        return capability;
    }
    var rawState = NotificationCtor && NotificationCtor.permission ? NotificationCtor.permission : null;
    capability.permission = {
        state: normalizePermissionState(rawState),
        raw: rawState || null,
        lastChecked: toISOString(context.now()),
        source: "notification",
    };
    return capability;
}

async function detectScreenWakeLock(context) {
    var capability = createCapability(context, "power.screenWakeLock", "Screen wake lock");
    var navigatorObject = context.global && context.global.navigator ? context.global.navigator : null;
    capability.supported = !!(navigatorObject && navigatorObject.wakeLock);
    if (!capability.supported) {
        capability.reason = navigatorObject ? "wake-lock-unavailable" : "navigator-unavailable";
    }
    capability.permission = await queryPermission(context, { name: "wake-lock", type: "screen" }, "permission-query-unsupported");
    return capability;
}

async function detectStorageAccess(context) {
    var capability = createCapability(context, "storage.access", "Storage access");
    var documentObject = context.global && context.global.document ? context.global.document : null;
    capability.supported = !!(documentObject && (hasFunction(documentObject, "requestStorageAccess") || hasFunction(documentObject, "hasStorageAccess")));
    if (!capability.supported) {
        capability.reason = documentObject ? "storage-access-unavailable" : "document-unavailable";
    }
    capability.permission = await queryPermission(context, { name: "storage-access" }, "permission-query-unsupported");
    return capability;
}

async function detectDynamicCode(context) {
    var capability = createCapability(context, "execution.dynamicCode", "Dynamic code generation");
    capability.permission = {
        state: "unknown",
        lastChecked: toISOString(context.now()),
        source: "static",
        reason: "dynamic-code-policy-determined-at-runtime",
    };
    try {
        var FunctionCtor = context.global && typeof context.global.Function === "function"
            ? context.global.Function
            : Function;
        var probe = new FunctionCtor("return 42;");
        var result = probe();
        capability.details = {
            functionConstructor: true,
            probeResult: result,
        };
        if (result === 42) {
            capability.supported = true;
        } else {
            capability.supported = false;
            capability.reason = "dynamic-code-unexpected-value";
            capability.error = {
                name: "DynamicCodeProbeError",
                message: "Function constructor returned unexpected value",
                expected: 42,
                actual: result,
            };
        }
    } catch (error) {
        capability.supported = false;
        capability.reason = "dynamic-code-blocked";
        capability.error = formatError(error);
    }
    return capability;
}

const DETECTORS = [
    { group: "audio", key: "input", detector: detectAudioInput },
    { group: "audio", key: "output", detector: detectAudioOutput },
    { group: "video", key: "camera", detector: detectCamera },
    { group: "clipboard", key: "read", detector: detectClipboardRead },
    { group: "clipboard", key: "write", detector: detectClipboardWrite },
    { group: "display", key: "fullscreen", detector: detectFullscreen },
    { group: "display", key: "pointerLock", detector: detectPointerLock },
    { group: "notifications", key: "default", detector: detectNotifications },
    { group: "power", key: "screenWakeLock", detector: detectScreenWakeLock },
    { group: "storage", key: "access", detector: detectStorageAccess },
    { group: "execution", key: "dynamicCode", detector: detectDynamicCode },
];

export async function collectResourceCapabilityMatrix(options = {}) {
    var globalObject = getGlobalObject(options);
    var nowFn = typeof options.now === "function" ? options.now : function() { return Date.now(); };
    var context = { global: globalObject, now: nowFn };
    var timestamp = toISOString(nowFn());
    var groups = {};
    var errors = [];
    for (var i = 0; i < DETECTORS.length; i++) {
        var descriptor = DETECTORS[i];
        try {
            var capability = await descriptor.detector(context);
            capability = finalizeCapability(capability, context);
            if (!groups[descriptor.group]) groups[descriptor.group] = {};
            groups[descriptor.group][descriptor.key] = capability;
            if (capability && capability.permission && capability.permission.error) {
                errors.push(capability.permission.error);
            } else if (capability && capability.error) {
                errors.push(capability.error);
            }
        } catch (error) {
            var formatted = formatError(error);
            if (!groups[descriptor.group]) groups[descriptor.group] = {};
            groups[descriptor.group][descriptor.key] = finalizeCapability({
                id: descriptor.group + "." + descriptor.key,
                label: "" + descriptor.key,
                supported: false,
                error: formatted,
            }, context);
            errors.push(formatted);
        }
    }
    var report = {
        version: REPORT_VERSION,
        generatedAt: timestamp,
        groups: groups,
    };
    if (errors.length) report.errors = errors;
    return report;
}

function updatePendingState(globalObject, isPending) {
    var state = ensureBrowserState(globalObject);
    if (state) state.resourceCapabilitiesPending = !!isPending;
}

function recordReport(globalObject, report) {
    cachedReport = report || null;
    var state = ensureBrowserState(globalObject);
    if (state) {
        state.resourceCapabilities = cachedReport;
        state.resourceCapabilitiesTimestamp = cachedReport && cachedReport.generatedAt
            ? cachedReport.generatedAt
            : toISOString(Date.now());
    }
    return cachedReport;
}

function recordDetectionError(globalObject, error) {
    var state = ensureBrowserState(globalObject);
    if (!state) return;
    state.resourceCapabilitiesError = error ? formatError(error) : null;
}

export function getResourceCapabilityReport() {
    return cachedReport;
}

export function setResourceCapabilityReport(report, options = {}) {
    var globalObject = getGlobalObject(options);
    updatePendingState(globalObject, false);
    recordDetectionError(globalObject, null);
    return recordReport(globalObject, report);
}

export async function ensureResourceCapabilityReport(options = {}) {
    var force = !!options.force;
    if (cachedReport && !force) return cachedReport;
    if (pendingDetection) return pendingDetection;
    var globalObject = getGlobalObject(options);
    updatePendingState(globalObject, true);
    pendingDetection = collectResourceCapabilityMatrix(options).then(function(report) {
        updatePendingState(globalObject, false);
        recordDetectionError(globalObject, null);
        return recordReport(globalObject, report);
    }).catch(function(error) {
        updatePendingState(globalObject, false);
        recordDetectionError(globalObject, error);
        throw error;
    }).finally(function() {
        pendingDetection = null;
    });
    return pendingDetection;
}

export function __resetResourceCapabilityCacheForTests(options = {}) {
    cachedReport = null;
    pendingDetection = null;
    var globalObject = getGlobalObject(options);
    var state = ensureBrowserState(globalObject);
    if (state) {
        delete state.resourceCapabilities;
        delete state.resourceCapabilitiesTimestamp;
        delete state.resourceCapabilitiesError;
        state.resourceCapabilitiesPending = false;
    }
}

export function formatResourceCapabilityError(error) {
    return formatError(error);
}
