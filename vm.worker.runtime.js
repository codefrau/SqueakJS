"use strict";

const DISPLAY_EXPECTATIONS = [
    {
        name: "primitiveBeDisplay",
        description: "Install the display Form into special objects table",
        status: "required",
    },
    {
        name: "primitiveShowDisplayRect",
        description: "Blit a rectangle from the display form",
        status: "required",
    },
    {
        name: "primitiveForceDisplayUpdate",
        description: "Flush pending display updates immediately",
        status: "required",
    },
    {
        name: "primitiveReverseDisplay",
        description: "Toggle bit-blt inversion for display rendering",
        status: "required",
    },
    {
        name: "primitiveScreenSize",
        description: "Report logical screen width/height",
        status: "required",
    },
    {
        name: "primitiveScreenDepth",
        description: "Report current display depth",
        status: "required",
    },
    {
        name: "primitiveScreenScaleFactor",
        description: "Return active HiDPI scaling factor",
        status: "required",
    },
    {
        name: "primitiveTestDisplayDepth",
        description: "Check whether the depth is supported",
        status: "required",
    },
    {
        name: "primitiveBeCursor",
        description: "Upload cursor imagery to the host",
        status: "fallback",
    },
];

const FILE_EXPECTATIONS = [
    "primitiveFileOpen",
    "primitiveFileRead",
    "primitiveFileWrite",
    "primitiveFileClose",
    "primitiveFileAtEnd",
    "primitiveDirectoryLookup",
    "primitiveDirectoryCreate",
    "primitiveDirectoryDelete",
];

const MAIN_THREAD_DEPENDENCIES = [
    {
        api: "Fullscreen API",
        reason: "Browser security rules require user-gesture initiated fullscreen requests on the main thread.",
        fallback: "Worker notifies host via display primitive; host owns document.fullscreenElement lifecycle.",
    },
    {
        api: "Clipboard API (navigator.clipboard)",
        reason: "Permission-gated clipboard reads and writes can only be triggered from user gestures on the main thread.",
        fallback: "Worker proxies requests over the structured-clone bridge and caches stale clipboard text when denied.",
    },
    {
        api: "AudioContext resume/start",
        reason: "Audio graphs must be created and resumed on the main thread in response to a user gesture in modern browsers.",
        fallback: "Worker emits audio-warning events so the host can bootstrap an AudioWorklet or main-thread Web Audio graph.",
    },
];

function buildDisplayReport() {
    var prototype = Squeak && Squeak.Primitives && Squeak.Primitives.prototype ? Squeak.Primitives.prototype : {};
    var supported = [];
    var missing = [];
    var fallbacks = [];
    DISPLAY_EXPECTATIONS.forEach(function(entry) {
        var hasPrimitive = typeof prototype[entry.name] === "function";
        var payload = {
            name: entry.name,
            description: entry.description,
        };
        if (entry.status === "fallback") {
            payload.available = hasPrimitive;
            fallbacks.push(payload);
            return;
        }
        (hasPrimitive ? supported : missing).push(payload);
    });
    return {
        plugin: "display-worker-offscreen",
        supported: supported,
        missing: missing,
        fallbacks: fallbacks,
    };
}

function buildAudioReport() {
    function analyze(fn) {
        var supported = typeof fn === "function" && !fn.isWorkerFallback;
        var fallback = typeof fn === "function" && !!fn.isWorkerFallback;
        return {
            supported: supported,
            fallback: fallback,
        };
    }
    return {
        output: analyze(Squeak && Squeak.startAudioOut),
        input: analyze(Squeak && Squeak.startAudioIn),
    };
}

function buildFileReport() {
    var prototype = Squeak && Squeak.Primitives && Squeak.Primitives.prototype ? Squeak.Primitives.prototype : {};
    var missing = [];
    FILE_EXPECTATIONS.forEach(function(name) {
        if (typeof prototype[name] !== "function") {
            missing.push(name);
        }
    });
    return {
        plugin: "FilePlugin",
        missingOperations: missing,
    };
}

export function ensureWorkerAudioFallbacks(post) {
    var messenger = typeof post === "function" ? post : function() {};
    if (typeof Squeak.startAudioOut !== "function") {
        function workerAudioFallbackStartOut() {
            messenger("audio-warning", { message: "Audio output unavailable in worker prototype" });
            return null;
        }
        workerAudioFallbackStartOut.isWorkerFallback = true;
        function workerAudioFallbackStopOut() {}
        workerAudioFallbackStopOut.isWorkerFallback = true;
        Squeak.startAudioOut = workerAudioFallbackStartOut;
        Squeak.stopAudioOut = workerAudioFallbackStopOut;
    }
    if (typeof Squeak.startAudioIn !== "function") {
        function workerAudioFallbackStartIn(thenDo, errorDo) {
            if (typeof errorDo === "function") {
                errorDo("audio input unavailable in worker prototype");
            }
            messenger("audio-warning", { message: "Audio input unavailable in worker prototype" });
        }
        workerAudioFallbackStartIn.isWorkerFallback = true;
        function workerAudioFallbackStopIn() {}
        workerAudioFallbackStopIn.isWorkerFallback = true;
        Squeak.startAudioIn = workerAudioFallbackStartIn;
        Squeak.stopAudioIn = workerAudioFallbackStopIn;
    }
}

export function collectWorkerFeatureReport() {
    return {
        timestamp: new Date().toISOString(),
        version: Squeak && Squeak.vmVersion,
        display: buildDisplayReport(),
        audio: buildAudioReport(),
        file: buildFileReport(),
        mainThreadDependencies: MAIN_THREAD_DEPENDENCIES.slice(),
    };
}
