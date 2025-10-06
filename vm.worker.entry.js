"use strict";

import "./globals.js";
import "./vm.js";
import "./vm.object.js";
import "./vm.object.spur.js";
import "./vm.image.js";
import "./vm.interpreter.js";
import "./vm.interpreter.proxy.js";
import "./vm.instruction.stream.js";
import "./vm.instruction.stream.sista.js";
import "./vm.instruction.printer.js";
import "./vm.primitives.js";
import "./jit.js";
import "./vm.display.js";
import "./vm.display.worker.stub.js";
import "./vm.input.js";
import "./vm.input.browser.js";
import "./vm.plugins.js";
import "./vm.plugins.ffi.js";
import "./vm.plugins.javascript.js";
import "./vm.plugins.obsolete.js";
import "./vm.plugins.drop.browser.js";
import "./vm.plugins.file.browser.js";
import "./vm.plugins.jpeg2.browser.js";
import "./vm.plugins.scratch.browser.js";
import "./vm.plugins.sound.browser.js";
import "./plugins/ADPCMCodecPlugin.js";
import "./plugins/B2DPlugin.js";
import "./plugins/B3DAcceleratorPlugin.js";
import "./plugins/BitBltPlugin.js";
import "./plugins/CroquetPlugin.js";
import "./plugins/FFTPlugin.js";
import "./plugins/FloatArrayPlugin.js";
import "./plugins/GeniePlugin.js";
import "./plugins/JPEGReaderPlugin.js";
import "./plugins/KedamaPlugin.js";
import "./plugins/KedamaPlugin2.js";
import "./plugins/Klatt.js";
import "./plugins/LargeIntegers.js";
import "./plugins/Matrix2x3Plugin.js";
import "./plugins/MiscPrimitivePlugin.js";
import "./plugins/MIDIPlugin.js";
import "./plugins/ScratchPlugin.js";
import "./plugins/SocketPlugin.js";
import "./plugins/SpeechPlugin.js";
import "./plugins/SqueakSSL.js";
import "./plugins/SoundGenerationPlugin.js";
import "./plugins/StarSqueakPlugin.js";
import "./plugins/UUIDPlugin.js";
import "./plugins/ClipboardExtendedPlugin.js";
import "./plugins/ZipPlugin.js";
import "./ffi/libc.js";
import "./ffi/opengl.js";
import "./lib/lz-string.js";
import "./lib/sha1.js";
import { ensureWorkerAudioFallbacks, collectWorkerFeatureReport } from "./vm.worker.runtime.js";
import { ensureStorageCapabilityReport, setStorageCapabilityReport, getStorageCapabilityReport } from "./vm.storage.capabilities.js";

var port = self;
var workerState = {
    vm: null,
    display: null,
    options: {},
    runHandle: null,
    firstFrameSent: false,
};

var clipboardRequests = new Map();
var clipboardRequestId = 1;

function post(type, detail) {
    port.postMessage(Object.assign({ type: type }, detail || {}));
}

ensureWorkerAudioFallbacks(post);

function queueWorkerEvent(evt) {
    if (!workerState.display || !evt) return;
    if (Array.isArray(evt)) {
        workerState.display.queueEvent(evt);
    }
}

function queueWorkerEvents(events) {
    if (!events || !events.length) return;
    for (var i = 0; i < events.length; i++) {
        queueWorkerEvent(events[i]);
    }
}

function handleClipboardReadRequest() {
    var requestId = clipboardRequestId++;
    return new Promise(function(resolve, reject) {
        clipboardRequests.set(requestId, { resolve: resolve, reject: reject });
        post("clipboard-read-request", { requestId: requestId });
    });
}

function handleClipboardWriteRequest(text) {
    var requestId = clipboardRequestId++;
    return new Promise(function(resolve, reject) {
        clipboardRequests.set(requestId, { resolve: resolve, reject: reject });
        post("clipboard-write-request", { requestId: requestId, text: text });
    });
}

function createDisplay(options) {
    options = options || {};
    var display = {
        width: options.width || 0,
        height: options.height || 0,
        depth: options.depth || 32,
        scale: options.scale && options.scale > 0 ? options.scale : 1,
        highdpi: !!options.highdpi,
        mouseX: 0,
        mouseY: 0,
        buttons: 0,
        keys: [],
        clipboardString: "",
        clipboardStringChanged: false,
        signalInputEvent: null,
        idle: 0,
        eventQueue: [],
        eventQueueOffset: null,
        vmOptions: ["-vm-display-worker"],
        quitFlag: false,
        offscreenCanvas: options.offscreenCanvas || null,
        devicePixelRatio: options.devicePixelRatio && options.devicePixelRatio > 0 ? options.devicePixelRatio : 1,
    };

    display.reset = function() {
        display.keys = [];
        display.buttons = 0;
        display.idle = 0;
        display.eventQueue = [];
        display.eventQueueOffset = null;
        display.signalInputEvent = null;
    };

    display.readFromSystemClipboard = function() {
        return handleClipboardReadRequest().then(function(payload) {
            if (!payload || typeof payload.text !== "string") return;
            display.clipboardString = payload.text;
            display.clipboardStringChanged = false;
            return payload.text;
        });
    };

    display.writeToSystemClipboard = function() {
        var text = typeof display.clipboardString === "string" ? display.clipboardString : "";
        return handleClipboardWriteRequest(text).then(function() {
            display.clipboardStringChanged = false;
            return text;
        });
    };

    display.ensureSurface = function(form) {
        if (!display.offscreenCanvas) return;
        var logicalWidth = form.width | 0;
        var logicalHeight = form.height | 0;
        if (logicalWidth <= 0 || logicalHeight <= 0) return;
        var pixelWidth = logicalWidth;
        var pixelHeight = logicalHeight;
        if (display.offscreenCanvas.width !== pixelWidth || display.offscreenCanvas.height !== pixelHeight) {
            display.offscreenCanvas.width = pixelWidth;
            display.offscreenCanvas.height = pixelHeight;
            display.context = display.offscreenCanvas.getContext("2d", { alpha: false, desynchronized: true });
            if (display.context) {
                display.context.imageSmoothingEnabled = false;
            }
            display.width = logicalWidth;
            display.height = logicalHeight;
            post("display-geometry", {
                width: logicalWidth,
                height: logicalHeight,
                pixelWidth: pixelWidth,
                pixelHeight: pixelHeight,
                scale: display.scale,
                devicePixelRatio: display.highdpi ? display.devicePixelRatio : 1,
            });
        } else if (!display.context) {
            display.context = display.offscreenCanvas.getContext("2d", { alpha: false, desynchronized: true });
            if (display.context) display.context.imageSmoothingEnabled = false;
        }
    };

    display.present = function(rect) {
        if (!workerState.firstFrameSent) {
            workerState.firstFrameSent = true;
            post("first-frame", { rect: rect || null });
        }
    };

    display.queueEvent = function(evt) {
        if (!evt || !Array.isArray(evt)) return;
        if (display.eventQueueOffset === null) {
            display.eventQueueOffset = Date.now() - evt[1];
        }
        display.eventQueue.push(evt);
        if (display.signalInputEvent) {
            try { display.signalInputEvent(); } catch (_) {}
        }
        display.idle = 0;
    };

    display.getNextEvent = function(buffer, offset) {
        if (!display.eventQueue.length) {
            buffer[0] = Squeak.EventTypeNone;
            return;
        }
        var evt = display.eventQueue.shift();
        var epochOffset = display.eventQueueOffset || 0;
        buffer[0] = evt[0];
        buffer[1] = (evt[1] - (offset - epochOffset)) & Squeak.MillisecondClockMask;
        for (var i = 2; i < evt.length && i < buffer.length; i++) {
            buffer[i] = evt[i];
        }
        for (var j = evt.length; j < buffer.length; j++) {
            buffer[j] = 0;
        }
        if (!display.eventQueue.length) {
            display.eventQueueOffset = null;
        }
    };

    display.showBanner = function(message) {
        post("display-banner", { message: message });
    };

    display.showProgress = function(value) {
        post("display-progress", { value: value });
    };

    display.setTitle = function(title) {
        post("display-title", { title: title });
    };

    display.clear = function() {
        post("display-clear");
    };

    display.notifyDisplayRect = function(rect) {
        display.present(rect);
        post("display-rect", { rect: rect });
    };

    display.notifyForceDisplayUpdate = function() {
        display.present(null);
        post("display-force-update");
    };

    display.reset();
    return display;
}

function runLoop() {
    if (!workerState.vm) return;
    try {
        workerState.vm.interpret(50, function(nextWait) {
            if (!workerState.vm) return;
            if (workerState.display && workerState.display.quitFlag) {
                post("status", { state: "stopped", reason: "quit" });
                return;
            }
            var delay = typeof nextWait === "number" ? nextWait : 0;
            if (delay === "sleep") delay = 20;
            if (delay < 0 || !isFinite(delay)) delay = 0;
            workerState.runHandle = setTimeout(runLoop, delay);
        });
    } catch (error) {
        post("error", { message: error.message, stack: error.stack });
    }
}

function startVM(buffer, name, options) {
    options = options || {};
    workerState.options = options;
    workerState.firstFrameSent = false;
    post("status", { state: "loading" });
    var memoryOptions = options.memory || (options.vm && options.vm.memory);
    var capabilityPromise;
    if (options.storageCapabilityDetection === false) {
        capabilityPromise = Promise.resolve(getStorageCapabilityReport());
    } else if (options.storageCapabilities !== undefined) {
        capabilityPromise = Promise.resolve(setStorageCapabilityReport(options.storageCapabilities));
    } else {
        capabilityPromise = ensureStorageCapabilityReport({ timeoutMs: options.storageCapabilityTimeoutMs });
    }
    var capabilityReadyPromise = capabilityPromise.then(function(report) {
        workerState.options.storageCapabilities = report || null;
        post("storage-capability-report", { report: report || null });
        return report;
    }).catch(function(error) {
        var payload = {
            error: error && error.message ? error.message : String(error),
            name: error && error.name ? error.name : "Error",
        };
        post("storage-capability-report", payload);
        workerState.options.storageCapabilities = null;
        return null;
    });
    var image = new Squeak.Image(name.replace(/\.image$/i, ""), memoryOptions);
    image.readFromBuffer(buffer, function onReady() {
        capabilityReadyPromise.then(function(report) {
            try {
                workerState.display = createDisplay(options.display || {});
                var vmOptions = Object.assign({}, options.vm || {});
                if (memoryOptions && !vmOptions.memory) vmOptions.memory = memoryOptions;
                var telemetryOptions = options.memoryTelemetry !== undefined ? options.memoryTelemetry
                    : (options.vm && options.vm.memoryTelemetry !== undefined ? options.vm.memoryTelemetry : undefined);
                if (telemetryOptions !== undefined && vmOptions.memoryTelemetry === undefined) {
                    vmOptions.memoryTelemetry = telemetryOptions;
                }
                if (report && vmOptions.storageCapabilities === undefined) {
                    vmOptions.storageCapabilities = report;
                }
                workerState.vm = new Squeak.Interpreter(image, workerState.display, vmOptions);
                workerState.display.vm = workerState.vm;
                workerState.display.reset();
                post("status", { state: "running", phase: "started" });
                runLoop();
            } catch (error) {
                post("error", { message: error.message, stack: error.stack });
            }
        });
    }, function onProgress(value) {
        post("status", { state: "loading", progress: value });
    });
}

function stopVM() {
    if (workerState.runHandle !== null) {
        clearTimeout(workerState.runHandle);
        workerState.runHandle = null;
    }
    workerState.vm = null;
    workerState.display = null;
    workerState.state = "idle";
    clipboardRequests.clear();
}

port.onmessage = function(event) {
    var data = event.data || {};
    switch (data.type) {
        case "load-image":
            stopVM();
            startVM(data.buffer, data.name || "squeak.image", data.options || {});
            break;
        case "input-event":
            if (workerState.display && data.event) {
                if (Array.isArray(data.event)) workerState.display.queueEvent(data.event);
            }
            break;
        case "input-events":
            queueWorkerEvents(data.events || []);
            break;
        case "pause":
            if (workerState.runHandle !== null) {
                clearTimeout(workerState.runHandle);
                workerState.runHandle = null;
                post("status", { state: "paused" });
            }
            break;
        case "resume":
            if (workerState.vm && workerState.runHandle === null) {
                post("status", { state: "running", phase: "resumed" });
                runLoop();
            }
            break;
        case "clipboard-set":
            if (workerState.display) {
                workerState.display.clipboardString = data.text || "";
                workerState.display.clipboardStringChanged = !!data.changed;
            }
            break;
        case "clipboard-read-response":
        case "clipboard-write-response":
            var resolver = clipboardRequests.get(data.requestId);
            if (resolver) {
                clipboardRequests.delete(data.requestId);
                if (data.error) resolver.reject(new Error(data.error));
                else resolver.resolve(data);
            }
            break;
        case "feature-report-request":
            post("feature-report", {
                requestId: typeof data.requestId === "number" ? data.requestId : 0,
                report: collectWorkerFeatureReport(),
            });
            break;
        case "terminate":
            stopVM();
            close();
            break;
    }
};

post("worker-ready", { version: Squeak.vmVersion });

