"use strict";

import { ensureStorageCapabilityReport, setStorageCapabilityReport, getStorageCapabilityReport } from "./vm.storage.capabilities.js";
import { createClipboardBridge, createClipboardRequestQueue } from "./vm.clipboard.js";
import { ensureResourceCapabilityReport, formatResourceCapabilityError } from "./vm.resource.capabilities.js";

const defaultWorkerURL = new URL("./vm.worker.entry.js", import.meta.url);
const GESTURE_WINDOW_MS = 1200;

function normalizeBuffer(source) {
    if (source instanceof ArrayBuffer) return source;
    if (ArrayBuffer.isView(source)) {
        var view = source;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
    throw new TypeError("Expected ArrayBuffer or typed array for image data");
}

export class WorkerVMController {
    constructor(options = {}) {
        this.workerScript = options.workerScript || defaultWorkerURL;
        this.workerOptions = options.workerOptions || { type: "module" };
        this._ensureResourceCapabilityReport = typeof options.ensureResourceCapabilityReport === "function"
            ? options.ensureResourceCapabilityReport
            : ensureResourceCapabilityReport;
        this._formatResourceCapabilityError = typeof options.formatResourceCapabilityError === "function"
            ? options.formatResourceCapabilityError
            : formatResourceCapabilityError;
        this.worker = null;
        this.state = "idle";
        this._listeners = new Map();
        this._readyPromise = null;
        this._resolveReady = null;
        this._firstFrameDeferred = null;
        this._lastStatus = null;
        this._displayTarget = null;
        this._offscreenCanvas = null;
        this._inputState = {
            lastMouseButtons: 0,
            lastModifiers: 0,
        };
        this._clipboardState = {
            text: "",
            cachedAt: null,
            lastRead: null,
            lastWrite: null,
            lastStatus: null,
            lastError: null,
            permission: {
                read: { state: "unknown", updatedAt: null },
                write: { state: "unknown", updatedAt: null },
            },
            staleDrops: 0,
            errorCounts: {},
            metricsKey: null,
            metricsUpdatedAt: null,
            queueState: null,
        };
        this._clipboardBridge = createClipboardBridge({
            getUserGesture: () => this._isGestureActive(),
            onStatus: (status) => this._recordClipboardStatus(status),
        });
        this._syncClipboardStateFromBridge();
        var controller = this;
        this._clipboardQueue = createClipboardRequestQueue({
            read: function(options) {
                var requestOptions = Object.assign({ fallbackToCache: true }, options || {});
                if (requestOptions.requireGesture === undefined) {
                    requestOptions.requireGesture = controller._isGestureActive();
                }
                if (!controller._clipboardBridge || typeof controller._clipboardBridge.readText !== "function") {
                    var cachedText = typeof controller._clipboardState.text === "string"
                        ? controller._clipboardState.text
                        : "";
                    return Promise.resolve({ text: cachedText, fromCache: true, permission: "unknown" });
                }
                return controller._clipboardBridge.readText(requestOptions);
            },
            write: function(text, options) {
                var requestOptions = Object.assign({}, options || {});
                if (requestOptions.requireGesture === undefined) {
                    requestOptions.requireGesture = controller._isGestureActive();
                }
                if (!controller._clipboardBridge || typeof controller._clipboardBridge.writeText !== "function") {
                    return Promise.resolve({ text: text, fromCache: true, permission: "unknown" });
                }
                return controller._clipboardBridge.writeText(text, requestOptions);
            },
        });
        this._pendingClipboard = new Map();
        this._pendingReports = new Map();
        this._nextReportId = 1;
        this._lastFeatureReport = null;
        this._lastGestureAt = 0;
    }

    on(type, handler) {
        if (!this._listeners.has(type)) this._listeners.set(type, new Set());
        this._listeners.get(type).add(handler);
        return () => this.off(type, handler);
    }

    off(type, handler) {
        var set = this._listeners.get(type);
        if (set) {
            set.delete(handler);
            if (set.size === 0) this._listeners.delete(type);
        }
    }

    emit(type, detail) {
        var set = this._listeners.get(type);
        if (!set) return;
        set.forEach(function(handler) {
            try {
                handler(detail);
            } catch (error) {
                if (typeof console !== "undefined" && console.error) {
                    console.error("WorkerVMController listener error", error);
                }
            }
        });
    }

    _recordClipboardStatus(status) {
        this._clipboardState.lastStatus = status || null;
        this._syncClipboardStateFromBridge();
        this.emit("clipboard-status", status);
    }

    _syncClipboardStateFromBridge(snapshot) {
        if (!snapshot && this._clipboardBridge && typeof this._clipboardBridge.getState === "function") {
            snapshot = this._clipboardBridge.getState();
        }
        if (!snapshot || typeof snapshot !== "object") return;
        if (typeof snapshot.cachedText === "string") this._clipboardState.text = snapshot.cachedText;
        if (snapshot.cachedAt !== undefined) this._clipboardState.cachedAt = snapshot.cachedAt;
        if (snapshot.lastRead !== undefined) this._clipboardState.lastRead = snapshot.lastRead;
        if (snapshot.lastWrite !== undefined) this._clipboardState.lastWrite = snapshot.lastWrite;
        if (snapshot.lastStatus !== undefined) this._clipboardState.lastStatus = snapshot.lastStatus;
        if (snapshot.lastError !== undefined) this._clipboardState.lastError = snapshot.lastError ? Object.assign({}, snapshot.lastError) : null;
        if (snapshot.permission !== undefined) {
            this._clipboardState.permission = {
                read: Object.assign({}, snapshot.permission.read || {}),
                write: Object.assign({}, snapshot.permission.write || {}),
            };
        }
        if (snapshot.errorCounts !== undefined) this._clipboardState.errorCounts = Object.assign({}, snapshot.errorCounts);
        if (snapshot.staleDrops !== undefined) this._clipboardState.staleDrops = snapshot.staleDrops;
        if (snapshot.metricsKey !== undefined) this._clipboardState.metricsKey = snapshot.metricsKey;
        if (snapshot.metricsUpdatedAt !== undefined) this._clipboardState.metricsUpdatedAt = snapshot.metricsUpdatedAt;
    }

    getClipboardDiagnostics() {
        this._syncClipboardStateFromBridge();
        var queueState = this._clipboardQueue && typeof this._clipboardQueue.getState === "function"
            ? this._clipboardQueue.getState()
            : (this._clipboardState.queueState || { pending: 0, last: null });
        this._clipboardState.queueState = queueState;
        var permissions = this._clipboardState.permission || { read: { state: "unknown" }, write: { state: "unknown" } };
        var preview = this._clipboardState.text || "";
        if (preview.length > 120) preview = preview.slice(0, 117) + "...";
        return {
            text: this._clipboardState.text || "",
            preview: preview,
            cachedAt: this._clipboardState.cachedAt,
            lastRead: this._clipboardState.lastRead,
            lastWrite: this._clipboardState.lastWrite,
            permissions: {
                read: permissions.read && permissions.read.state ? permissions.read.state : "unknown",
                write: permissions.write && permissions.write.state ? permissions.write.state : "unknown",
            },
            permissionDetail: {
                read: Object.assign({}, permissions.read || {}),
                write: Object.assign({}, permissions.write || {}),
            },
            queuePending: queueState.pending || 0,
            queueLast: queueState.last || null,
            lastStatus: this._clipboardState.lastStatus || null,
            lastError: this._clipboardState.lastError || null,
            staleDrops: this._clipboardState.staleDrops || 0,
            errorCounts: Object.assign({}, this._clipboardState.errorCounts || {}),
            metricsKey: this._clipboardState.metricsKey || null,
            metricsUpdatedAt: this._clipboardState.metricsUpdatedAt || null,
        };
    }

    _markGesture() {
        this._lastGestureAt = Date.now();
    }

    _isGestureActive() {
        if (!this._lastGestureAt) return false;
        return Date.now() - this._lastGestureAt < GESTURE_WINDOW_MS;
    }

    async _ensureWorker() {
        if (this.worker) return this._readyPromise;
        var options = this.workerOptions;
        if (!options || typeof options !== "object") options = { type: "module" };
        if (!("type" in options)) options.type = "module";
        this.worker = new Worker(this.workerScript, options);
        var controller = this;
        this.worker.onmessage = function(event) {
            controller._handleMessage(event.data);
        };
        this.worker.onerror = function(event) {
            controller.emit("error", event);
        };
        this.worker.onmessageerror = function(event) {
            controller.emit("error", event);
        };
        this._readyPromise = new Promise(function(resolve) {
            controller._resolveReady = resolve;
        });
        return this._readyPromise;
    }

    _handleMessage(data) {
        if (!data || typeof data.type !== "string") return;
        if (data.type === "worker-ready" && this._resolveReady) {
            this._resolveReady(data);
            this._resolveReady = null;
            this.state = "ready";
        }
        if (data.type === "status" && data.state) {
            this.state = data.state;
            this._lastStatus = data;
        }
        if (data.type === "error") {
            this.state = "error";
            if (this._firstFrameDeferred) {
                this._firstFrameDeferred.reject(data);
                this._firstFrameDeferred = null;
            }
        }
        if (data.type === "first-frame" && this._firstFrameDeferred) {
            this.state = "running";
            this._firstFrameDeferred.resolve(data);
            this._firstFrameDeferred = null;
        }
        if (data.type === "display-geometry") {
            this._applyDisplayGeometry(data);
        }
        if (data.type === "clipboard-set") {
            if (typeof data.text === "string") {
                var timestamp = typeof data.timestamp === "number" && isFinite(data.timestamp) ? data.timestamp : Date.now();
                if (this._clipboardBridge) {
                    this._clipboardBridge.setCachedText(data.text, timestamp);
                    this._syncClipboardStateFromBridge();
                } else {
                    this._clipboardState.text = data.text;
                    this._clipboardState.cachedAt = timestamp;
                }
                this._clipboardState.lastWrite = timestamp;
            }
        }
        if (data.type === "clipboard-read-request" || data.type === "clipboard-write-request") {
            this._handleClipboardMessage(data);
            return;
        }
        if ((data.type === "clipboard-read-response" || data.type === "clipboard-write-response") && typeof data.requestId === "number") {
            var resolver = this._pendingClipboard.get(data.requestId);
            if (resolver) {
                this._pendingClipboard.delete(data.requestId);
                if (data.error) resolver.reject(new Error(data.error));
                else resolver.resolve(data);
            }
            return;
        }
        if (data.type === "storage-capability-report") {
            if (data.report !== undefined) {
                setStorageCapabilityReport(data.report);
            }
            if (data.error && typeof console !== "undefined" && console.warn) {
                console.warn("[SqueakJS][storage] worker capability detection warning", data);
            }
            this.emit(data.type, data);
            return;
        }
        if (data.type === "feature-report") {
            this._handleFeatureReportMessage(data);
            return;
        }
        this.emit(data.type, data);
    }

    _handleFeatureReportMessage(data) {
        var controller = this;
        var ensureReport = this._ensureResourceCapabilityReport || ensureResourceCapabilityReport;
        var formatError = this._formatResourceCapabilityError || formatResourceCapabilityError;
        Promise.resolve().then(function() {
            return ensureReport();
        }).then(function(report) {
            if (data && data.report && report) {
                data.report.resourceCapabilities = report;
            }
        }).catch(function(error) {
            var formatted = formatError(error);
            if (formatted) {
                if (!data.errors) data.errors = [];
                data.errors.push(formatted);
                data.resourceCapabilityError = formatted;
            }
        }).finally(function() {
            controller._finalizeFeatureReportMessage(data);
        });
    }

    _finalizeFeatureReportMessage(data) {
        if (data.report) {
            this._lastFeatureReport = data.report;
        }
        if (typeof data.requestId === "number") {
            var pendingReport = this._pendingReports.get(data.requestId);
            if (pendingReport) {
                this._pendingReports.delete(data.requestId);
                pendingReport.resolve(data);
            }
        }
        this.emit(data.type, data);
    }

    _applyDisplayGeometry(data) {
        if (!this._displayTarget || !this._displayTarget.canvas) return;
        var canvas = this._displayTarget.canvas;
        if (!canvas) return;
        if (typeof data.pixelWidth === "number" && typeof data.pixelHeight === "number") {
            canvas.width = data.pixelWidth;
            canvas.height = data.pixelHeight;
        }
        if (typeof data.width === "number" && typeof data.height === "number") {
            var scale = typeof data.scale === "number" && isFinite(data.scale) ? data.scale : 1;
            canvas.style.width = Math.round(data.width * scale) + "px";
            canvas.style.height = Math.round(data.height * scale) + "px";
        }
    }

    _handleClipboardMessage(data) {
        var controller = this;
        var type = data.type;
        if (type === "clipboard-read-request") {
            var requestId = data.requestId;
            var basePayload = { type: "clipboard-read-response", requestId: requestId };
            var handler = this._clipboardQueue.enqueueRead({ fallbackToCache: true });
            handler.then(function(result) {
                var payload = result && typeof result === "object" ? Object.assign({}, result) : {};
                var text = typeof payload.text === "string"
                    ? payload.text
                    : (controller._clipboardBridge ? controller._clipboardBridge.getCachedText() : controller._clipboardState.text);
                if (typeof text !== "string") text = "";
                payload.text = text;
                controller._syncClipboardStateFromBridge(result && typeof result === "object" ? result.state : null);
                controller._clipboardState.text = text;
                controller._clipboardState.queueState = controller._clipboardQueue.getState();
                payload.cachedAt = controller._clipboardState.cachedAt;
                payload.lastRead = controller._clipboardState.lastRead;
                payload.lastWrite = controller._clipboardState.lastWrite;
                payload.staleDrops = controller._clipboardState.staleDrops;
                payload.errorCounts = Object.assign({}, controller._clipboardState.errorCounts || {});
                payload.permissionDetail = controller._clipboardState.permission;
                payload.queueState = controller._clipboardState.queueState;
                if (!payload.state && controller._clipboardBridge && typeof controller._clipboardBridge.getState === "function") {
                    payload.state = controller._clipboardBridge.getState();
                }
                var response = Object.assign({}, basePayload, payload);
                controller.worker.postMessage(response);
            }).catch(function(error) {
                var cachedText = controller._clipboardBridge ? controller._clipboardBridge.getCachedText() : controller._clipboardState.text;
                if (typeof cachedText !== "string") cachedText = "";
                controller._clipboardState.text = cachedText;
                controller._syncClipboardStateFromBridge();
                controller._clipboardState.queueState = controller._clipboardQueue.getState();
                var permissionState = controller._clipboardState.permission && controller._clipboardState.permission.read
                    ? controller._clipboardState.permission.read.state
                    : "unknown";
                var formatted = error && error.message ? { name: error.name || "Error", message: error.message } : null;
                var response = Object.assign({}, basePayload, {
                    text: cachedText,
                    fromCache: true,
                    permission: permissionState,
                    cachedAt: controller._clipboardState.cachedAt,
                    lastRead: controller._clipboardState.lastRead,
                    lastWrite: controller._clipboardState.lastWrite,
                    staleDrops: controller._clipboardState.staleDrops,
                    errorCounts: Object.assign({}, controller._clipboardState.errorCounts || {}),
                    permissionDetail: controller._clipboardState.permission,
                    queueState: controller._clipboardState.queueState,
                    state: controller._clipboardBridge && typeof controller._clipboardBridge.getState === "function"
                        ? controller._clipboardBridge.getState()
                        : null,
                });
                if (formatted) response.error = formatted;
                controller.worker.postMessage(response);
            });
            return;
        }
        if (type === "clipboard-write-request") {
            var text = typeof data.text === "string" ? data.text : "";
            var timestamp = Date.now();
            this._clipboardState.text = text;
            this._clipboardState.cachedAt = timestamp;
            this._clipboardState.lastWrite = timestamp;
            if (this._clipboardBridge) {
                this._clipboardBridge.setCachedText(text, timestamp);
                this._syncClipboardStateFromBridge();
            }
            var basePayload = { type: "clipboard-write-response", requestId: data.requestId };
            var writePromise = this._clipboardQueue.enqueueWrite(text, {});
            writePromise.then(function(result) {
                var payload = result && typeof result === "object" ? Object.assign({}, result) : {};
                if (payload.text === undefined) payload.text = text;
                controller._syncClipboardStateFromBridge(result && typeof result === "object" ? result.state : null);
                controller._clipboardState.queueState = controller._clipboardQueue.getState();
                payload.cachedAt = controller._clipboardState.cachedAt;
                payload.lastRead = controller._clipboardState.lastRead;
                payload.lastWrite = controller._clipboardState.lastWrite;
                payload.staleDrops = controller._clipboardState.staleDrops;
                payload.errorCounts = Object.assign({}, controller._clipboardState.errorCounts || {});
                payload.permissionDetail = controller._clipboardState.permission;
                payload.queueState = controller._clipboardState.queueState;
                if (!payload.state && controller._clipboardBridge && typeof controller._clipboardBridge.getState === "function") {
                    payload.state = controller._clipboardBridge.getState();
                }
                var response = Object.assign({}, basePayload, payload);
                controller.worker.postMessage(response);
            }).catch(function(error) {
                controller._syncClipboardStateFromBridge();
                controller._clipboardState.queueState = controller._clipboardQueue.getState();
                var permissionState = controller._clipboardState.permission && controller._clipboardState.permission.write
                    ? controller._clipboardState.permission.write.state
                    : "unknown";
                var formatted = error && error.message ? { name: error.name || "Error", message: error.message } : null;
                var response = Object.assign({}, basePayload, {
                    text: text,
                    fromCache: true,
                    permission: permissionState,
                    cachedAt: controller._clipboardState.cachedAt,
                    lastRead: controller._clipboardState.lastRead,
                    lastWrite: controller._clipboardState.lastWrite,
                    staleDrops: controller._clipboardState.staleDrops,
                    errorCounts: Object.assign({}, controller._clipboardState.errorCounts || {}),
                    permissionDetail: controller._clipboardState.permission,
                    queueState: controller._clipboardState.queueState,
                    state: controller._clipboardBridge && typeof controller._clipboardBridge.getState === "function"
                        ? controller._clipboardBridge.getState()
                        : null,
                });
                if (formatted) response.error = formatted;
                controller.worker.postMessage(response);
            });
        }
    }

    attachCanvas(canvas, options = {}) {
        if (!canvas) throw new TypeError("Expected a canvas element");
        var displayOptions = Object.assign({}, options || {});
        if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement) {
            if (this._displayTarget && this._displayTarget.canvas === canvas) {
                this._displayTarget.options = displayOptions;
                return this;
            }
            this._displayTarget = { canvas: canvas, offscreen: null, options: displayOptions };
            this._offscreenCanvas = null;
        } else if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
            if (this._displayTarget && this._displayTarget.offscreen === canvas) {
                this._displayTarget.options = displayOptions;
                return this;
            }
            this._displayTarget = { canvas: null, offscreen: canvas, options: displayOptions };
            this._offscreenCanvas = canvas;
        } else {
            throw new TypeError("attachCanvas expects HTMLCanvasElement or OffscreenCanvas");
        }
        return this;
    }

    _prepareDisplayOptions(displayOptions) {
        var options = Object.assign({}, displayOptions || {});
        var transfers = [];
        if (options.canvas) {
            this.attachCanvas(options.canvas, options);
            delete options.canvas;
        }
        if (this._displayTarget) {
            options = Object.assign({}, this._displayTarget.options || {}, options);
            if (this._displayTarget.canvas) {
                if (!this._offscreenCanvas) {
                    if (typeof this._displayTarget.canvas.transferControlToOffscreen !== "function") {
                        throw new Error("Canvas element does not support transferControlToOffscreen");
                    }
                    this._offscreenCanvas = this._displayTarget.canvas.transferControlToOffscreen();
                }
                options.offscreenCanvas = this._offscreenCanvas;
                transfers.push(this._offscreenCanvas);
            } else if (this._displayTarget.offscreen) {
                options.offscreenCanvas = this._displayTarget.offscreen;
                transfers.push(this._displayTarget.offscreen);
            }
            if (typeof options.devicePixelRatio !== "number" && typeof window !== "undefined") {
                options.devicePixelRatio = window.devicePixelRatio || 1;
            }
        }
        if (options.offscreenCanvas && transfers.indexOf(options.offscreenCanvas) < 0) {
            transfers.push(options.offscreenCanvas);
        }
        return { options: options, transfers: transfers };
    }

    async startFromImageUrl(imageUrl, startOptions = {}) {
        if (this.worker && this.state === "running") {
            throw new Error("Worker VM already running");
        }
        await this._ensureWorker();
        await this._readyPromise;
        var fetchOptions = startOptions.fetchOptions || { cache: "no-store" };
        var response = await fetch(imageUrl, fetchOptions);
        if (!response.ok) {
            throw new Error("Failed to fetch image: " + response.status + " " + response.statusText);
        }
        var buffer = await response.arrayBuffer();
        var name = startOptions.imageName || (typeof imageUrl === "string" ? imageUrl.split("/").pop() || "squeak.image" : "squeak.image");
        return this.startFromArrayBuffer(buffer, Object.assign({}, startOptions, { imageName: name }));
    }

    async startFromArrayBuffer(buffer, startOptions = {}) {
        if (this.worker && this.state === "running") {
            throw new Error("Worker VM already running");
        }
        await this._ensureWorker();
        await this._readyPromise;
        var transferable = normalizeBuffer(buffer);
        var prepared = this._prepareDisplayOptions(startOptions.display);
        var vmOptions = Object.assign({}, startOptions.vm || {});
        var memoryOptions = startOptions.memory || vmOptions.memory;
        if (memoryOptions && !vmOptions.memory) vmOptions.memory = memoryOptions;
        var telemetryOptions = startOptions.memoryTelemetry;
        if (telemetryOptions === undefined && vmOptions.memoryTelemetry !== undefined) {
            telemetryOptions = vmOptions.memoryTelemetry;
        }
        if (telemetryOptions !== undefined && vmOptions.memoryTelemetry === undefined) {
            vmOptions.memoryTelemetry = telemetryOptions;
        }
        var storageCapabilities = startOptions.storageCapabilities;
        var detectionDisabled = startOptions.storageCapabilityDetection === false;
        if (detectionDisabled) {
            if (storageCapabilities === undefined) {
                storageCapabilities = getStorageCapabilityReport() || null;
            } else {
                setStorageCapabilityReport(storageCapabilities);
            }
        } else if (storageCapabilities !== undefined) {
            setStorageCapabilityReport(storageCapabilities);
        } else {
            try {
                storageCapabilities = await ensureStorageCapabilityReport({
                    timeoutMs: startOptions.storageCapabilityTimeoutMs,
                });
            } catch (error) {
                storageCapabilities = null;
                if (typeof console !== "undefined" && console.warn) {
                    console.warn("[SqueakJS][storage] capability detection failed before worker start", error);
                }
            }
        }
        var payload = {
            type: "load-image",
            name: startOptions.imageName || "squeak.image",
            buffer: transferable,
            options: {
                vm: vmOptions,
                display: prepared.options,
                memory: memoryOptions,
                memoryTelemetry: telemetryOptions,
                storageCapabilities: storageCapabilities === undefined ? null : storageCapabilities,
            },
        };
        if (detectionDisabled) {
            payload.options.storageCapabilityDetection = false;
        }
        if (startOptions.storageCapabilityTimeoutMs !== undefined) {
            payload.options.storageCapabilityTimeoutMs = startOptions.storageCapabilityTimeoutMs;
        }
        var controller = this;
        return new Promise(function(resolve, reject) {
            controller._firstFrameDeferred = { resolve: resolve, reject: reject };
            var transferList = [transferable];
            prepared.transfers.forEach(function(item) {
                if (item && transferList.indexOf(item) < 0) {
                    transferList.push(item);
                }
            });
            controller.worker.postMessage(payload, transferList);
        });
    }

    sendInputEvent(eventPayload) {
        if (!this.worker) throw new Error("Worker VM is not started");
        this._markGesture();
        this.worker.postMessage({ type: "input-event", event: eventPayload });
    }

    sendInputEvents(eventPayloads) {
        if (!this.worker) throw new Error("Worker VM is not started");
        if (!Array.isArray(eventPayloads)) return;
        this._markGesture();
        this.worker.postMessage({ type: "input-events", events: eventPayloads });
    }

    setClipboardText(text, options = {}) {
        var normalized = typeof text === "string" ? text : "";
        var timestamp = typeof options.timestamp === "number" && isFinite(options.timestamp)
            ? options.timestamp
            : Date.now();
        this._clipboardState.text = normalized;
        this._clipboardState.cachedAt = timestamp;
        this._clipboardState.lastWrite = timestamp;
        if (this._clipboardBridge) {
            this._clipboardBridge.setCachedText(normalized, timestamp);
            this._syncClipboardStateFromBridge();
        }
        if (this.worker) {
            this.worker.postMessage({
                type: "clipboard-set",
                text: this._clipboardState.text,
                changed: options.changed === undefined ? true : !!options.changed,
                timestamp: timestamp,
            });
        }
    }

    requestClipboardText() {
        if (this._clipboardBridge) {
            return Promise.resolve(this._clipboardBridge.getCachedText());
        }
        return Promise.resolve(this._clipboardState.text);
    }

    requestFeatureReport(options = {}) {
        if (!this.worker) {
            return Promise.reject(new Error("Worker VM is not started"));
        }
        var requestId = this._nextReportId++;
        var controller = this;
        return new Promise(function(resolve, reject) {
            var entry = {
                timer: null,
                resolve: function(payload) {
                    if (entry.timer) clearTimeout(entry.timer);
                    resolve(payload);
                },
                reject: function(error) {
                    if (entry.timer) clearTimeout(entry.timer);
                    reject(error);
                },
            };
            if (options.timeout && options.timeout > 0) {
                entry.timer = setTimeout(function() {
                    controller._pendingReports.delete(requestId);
                    entry.reject(new Error("Feature report request timed out"));
                }, options.timeout);
            }
            controller._pendingReports.set(requestId, entry);
            controller.worker.postMessage({
                type: "feature-report-request",
                requestId: requestId,
            });
        }).then(function(payload) {
            if (payload && payload.report) {
                controller._lastFeatureReport = payload.report;
            }
            return payload;
        });
    }

    requestPause() {
        if (!this.worker) return;
        this.worker.postMessage({ type: "pause" });
    }

    requestResume() {
        if (!this.worker) return;
        this.worker.postMessage({ type: "resume" });
    }

    terminate() {
        if (!this.worker) return;
        try {
            this.worker.postMessage({ type: "terminate" });
        } catch (_) {}
        this.worker.terminate();
        this.worker = null;
        this.state = "terminated";
        this._readyPromise = null;
        this._resolveReady = null;
        this._firstFrameDeferred = null;
        this._pendingClipboard.forEach(function(entry) {
            if (entry && entry.reject) {
                entry.reject(new Error("worker terminated"));
            }
        });
        this._pendingClipboard.clear();
        this._pendingReports.forEach(function(entry) {
            if (entry && entry.reject) {
                entry.reject(new Error("worker terminated"));
            }
        });
        this._pendingReports.clear();
        this._nextReportId = 1;
        this._lastFeatureReport = null;
    }

    get status() {
        return this._lastStatus || { state: this.state };
    }

    get lastFeatureReport() {
        return this._lastFeatureReport;
    }
}

