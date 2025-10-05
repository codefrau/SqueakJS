"use strict";

const defaultWorkerURL = new URL("./vm.worker.entry.js", import.meta.url);

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
            lastUpdate: 0,
        };
        this._pendingClipboard = new Map();
        this._pendingReports = new Map();
        this._nextReportId = 1;
        this._lastFeatureReport = null;
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
                this._clipboardState.text = data.text;
                this._clipboardState.lastUpdate = Date.now();
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
        if (data.type === "feature-report") {
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
            return;
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
            var respond = function(payload) {
                controller.worker.postMessage(Object.assign({
                    type: "clipboard-read-response",
                    requestId: requestId,
                }, payload || {}));
            };
            if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.readText === "function") {
                navigator.clipboard.readText().then(function(text) {
                    controller._clipboardState.text = text;
                    controller._clipboardState.lastUpdate = Date.now();
                    respond({ text: text });
                }).catch(function(error) {
                    respond({ error: error && error.message ? error.message : String(error), text: controller._clipboardState.text });
                });
            } else {
                respond({ text: controller._clipboardState.text });
            }
            return;
        }
        if (type === "clipboard-write-request") {
            var text = typeof data.text === "string" ? data.text : "";
            this._clipboardState.text = text;
            this._clipboardState.lastUpdate = Date.now();
            var respondWrite = function(payload) {
                controller.worker.postMessage(Object.assign({
                    type: "clipboard-write-response",
                    requestId: data.requestId,
                }, payload || {}));
            };
            if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                navigator.clipboard.writeText(text).then(function() {
                    respondWrite({ text: text });
                }).catch(function(error) {
                    respondWrite({ error: error && error.message ? error.message : String(error), text: text });
                });
            } else {
                respondWrite({ text: text });
            }
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
        var payload = {
            type: "load-image",
            name: startOptions.imageName || "squeak.image",
            buffer: transferable,
            options: {
                vm: vmOptions,
                display: prepared.options,
                memory: memoryOptions,
                memoryTelemetry: telemetryOptions,
            },
        };
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
        this.worker.postMessage({ type: "input-event", event: eventPayload });
    }

    sendInputEvents(eventPayloads) {
        if (!this.worker) throw new Error("Worker VM is not started");
        if (!Array.isArray(eventPayloads)) return;
        this.worker.postMessage({ type: "input-events", events: eventPayloads });
    }

    setClipboardText(text, options = {}) {
        this._clipboardState.text = typeof text === "string" ? text : "";
        this._clipboardState.lastUpdate = Date.now();
        if (this.worker) {
            this.worker.postMessage({
                type: "clipboard-set",
                text: this._clipboardState.text,
                changed: options.changed === undefined ? true : !!options.changed,
            });
        }
    }

    requestClipboardText() {
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

