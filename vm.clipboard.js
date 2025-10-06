"use strict";

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_METRICS_STORAGE_KEY = "squeak.clipboard.metrics";

function clonePermissionSnapshot(source) {
    return {
        read: Object.assign({ state: "unknown", updatedAt: null }, source && source.read || {}),
        write: Object.assign({ state: "unknown", updatedAt: null }, source && source.write || {}),
    };
}

function safeLocalStorage(global) {
    try {
        if (!global || !global.localStorage) return null;
        var storage = global.localStorage;
        if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
            return null;
        }
        return storage;
    } catch (_) {
        return null;
    }
}

function getGlobal() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return {};
}

function nowTimestamp() {
    if (typeof Date !== "undefined" && typeof Date.now === "function") {
        return Date.now();
    }
    return 0;
}

function toErrorLike(error, fallbackName) {
    if (!error) {
        return { name: fallbackName || "Error", message: "" };
    }
    if (error instanceof Error) {
        return {
            name: error.name || fallbackName || "Error",
            message: error.message || "",
            code: error.code,
            type: error.type,
            reason: error.reason,
        };
    }
    if (typeof error === "string") {
        return { name: fallbackName || "Error", message: error };
    }
    var formatted = { name: fallbackName || (error.name || "Error") };
    if (error.message) formatted.message = String(error.message);
    else formatted.message = String(error);
    if (error.code !== undefined) formatted.code = error.code;
    if (error.type !== undefined) formatted.type = error.type;
    if (error.reason !== undefined) formatted.reason = error.reason;
    return formatted;
}

function createError(name, message, detail) {
    var error = new Error(message || name);
    error.name = name;
    if (detail && typeof detail === "object") {
        Object.keys(detail).forEach(function(key) {
            error[key] = detail[key];
        });
    }
    return error;
}

function runWithTimeout(factory, timeoutMs, operation) {
    var useTimeout = typeof timeoutMs === "number" && isFinite(timeoutMs) && timeoutMs > 0;
    if (!useTimeout) {
        try {
            return Promise.resolve().then(factory);
        } catch (error) {
            return Promise.reject(error);
        }
    }
    return new Promise(function(resolve, reject) {
        var settled = false;
        var timer = setTimeout(function() {
            if (settled) return;
            settled = true;
            var timeoutError = createError(
                "ClipboardTimeout",
                "Clipboard " + (operation || "operation") + " timed out after " + timeoutMs + "ms",
                { operation: operation || "unknown", timeoutMs: timeoutMs }
            );
            reject(timeoutError);
        }, timeoutMs);
        function cleanup() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        }
        var promise;
        try {
            promise = Promise.resolve().then(factory);
        } catch (error) {
            cleanup();
            reject(error);
            return;
        }
        promise.then(function(value) {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(value);
        }, function(error) {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        });
    });
}

function normalizePermissionState(status) {
    if (!status) return "unknown";
    if (typeof status.state === "string" && status.state) return status.state;
    if (typeof status.status === "string" && status.status) return status.status;
    return "unknown";
}

function ensurePermissionListener(status, onChange) {
    if (!status || typeof status.addEventListener !== "function" || typeof onChange !== "function") return;
    try {
        status.addEventListener("change", function() {
            try {
                onChange(normalizePermissionState(status));
            } catch (_) {}
        });
    } catch (_) {}
}

export function createClipboardBridge(options = {}) {
    var global = getGlobal();
    var navigatorRef = global && global.navigator ? global.navigator : undefined;
    var clipboardRef = navigatorRef && navigatorRef.clipboard ? navigatorRef.clipboard : undefined;
    var permissionsRef = navigatorRef && navigatorRef.permissions ? navigatorRef.permissions : undefined;
    var logger = typeof options.logger === "function" ? options.logger : null;
    var notify = typeof options.onStatus === "function" ? options.onStatus : null;
    var getGesture = typeof options.getUserGesture === "function" ? options.getUserGesture : function() { return false; };
    var timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs >= 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    var storageKey = typeof options.metricsStorageKey === "string" && options.metricsStorageKey
        ? options.metricsStorageKey
        : DEFAULT_METRICS_STORAGE_KEY;
    var storageRef = safeLocalStorage(global);
    var persistedErrorCounts = {};
    var persistedUpdatedAt = null;
    if (storageRef) {
        try {
            var rawMetrics = storageRef.getItem(storageKey);
            if (rawMetrics) {
                var parsedMetrics = JSON.parse(rawMetrics);
                if (parsedMetrics && typeof parsedMetrics === "object") {
                    if (parsedMetrics.errorCounts && typeof parsedMetrics.errorCounts === "object") {
                        persistedErrorCounts = Object.assign({}, parsedMetrics.errorCounts);
                    }
                    if (typeof parsedMetrics.updatedAt === "number" && isFinite(parsedMetrics.updatedAt)) {
                        persistedUpdatedAt = parsedMetrics.updatedAt;
                    }
                }
            }
        } catch (_) {}
    }
    var initialState = options.initialState && typeof options.initialState === "object" ? options.initialState : null;
    var initialText = initialState && typeof initialState.cachedText === "string"
        ? initialState.cachedText
        : (typeof options.initialText === "string" ? options.initialText : "");
    var state = {
        cachedText: normalizeText(initialText),
        cachedAt: initialState && typeof initialState.cachedAt === "number" ? initialState.cachedAt : (initialText ? nowTimestamp() : null),
        lastRead: initialState && typeof initialState.lastRead === "number" ? initialState.lastRead : null,
        lastWrite: initialState && typeof initialState.lastWrite === "number" ? initialState.lastWrite : null,
        lastError: initialState && typeof initialState.lastError === "object" ? Object.assign({}, initialState.lastError) : null,
        permission: clonePermissionSnapshot(initialState && initialState.permission),
        lastStatus: initialState && typeof initialState.lastStatus === "object" ? Object.assign({}, initialState.lastStatus) : null,
        errorCounts: Object.assign({}, persistedErrorCounts, initialState && typeof initialState.errorCounts === "object" ? initialState.errorCounts : {}),
        metricsKey: storageKey,
        metricsUpdatedAt: persistedUpdatedAt,
        staleDrops: initialState && typeof initialState.staleDrops === "number" ? initialState.staleDrops | 0 : 0,
    };

    var persistTimer = null;

    function flushMetrics() {
        if (!storageRef) return;
        var payload = {
            errorCounts: Object.assign({}, state.errorCounts),
            updatedAt: nowTimestamp(),
        };
        state.metricsUpdatedAt = payload.updatedAt;
        try {
            storageRef.setItem(storageKey, JSON.stringify(payload));
        } catch (_) {}
    }

    function schedulePersist() {
        if (!storageRef || typeof setTimeout !== "function") return;
        if (persistTimer) return;
        persistTimer = setTimeout(function() {
            persistTimer = null;
            flushMetrics();
        }, 200);
    }

    function emit(event, detail) {
        if (logger) {
            try {
                logger(event, detail);
            } catch (_) {}
            return;
        }
        if (typeof console !== "undefined" && console.debug) {
            console.debug("[SqueakJS][clipboard]", event, detail || "");
        }
    }

    function dispatchStatus(type, detail) {
        var payload = Object.assign({ type: type, timestamp: nowTimestamp() }, detail || {});
        state.lastStatus = payload;
        if (notify) {
            try {
                notify(payload);
            } catch (error) {
                if (typeof console !== "undefined" && console.warn) {
                    console.warn("[SqueakJS][clipboard] status callback failed", error);
                }
            }
        } else if (typeof console !== "undefined" && console.warn) {
            var message = payload && payload.message ? payload.message : type;
            console.warn("[SqueakJS][clipboard]", message);
        }
        return payload;
    }

    function updatePermission(kind, nextState) {
        var target = kind === "write" ? state.permission.write : state.permission.read;
        if (!target || !nextState || typeof nextState !== "object") return;
        var updatedAt = typeof nextState.updatedAt === "number" && isFinite(nextState.updatedAt)
            ? nextState.updatedAt
            : nowTimestamp();
        Object.keys(nextState).forEach(function(key) {
            target[key] = nextState[key];
        });
        target.updatedAt = updatedAt;
    }

    function queryPermission(kind) {
        var name = kind === "write" ? "clipboard-write" : "clipboard-read";
        if (!permissionsRef || typeof permissionsRef.query !== "function") {
            updatePermission(kind, { name: name, state: "unknown", supported: false });
            return Promise.resolve({ name: name, state: "unknown", supported: false });
        }
        return permissionsRef.query({ name: name }).then(function(status) {
            var normalized = normalizePermissionState(status);
            updatePermission(kind, { name: name, state: normalized, supported: true });
            ensurePermissionListener(status, function(next) {
                updatePermission(kind, { name: name, state: next, supported: true });
            });
            return { name: name, state: normalized, supported: true };
        }).catch(function(error) {
            var formatted = toErrorLike(error, "PermissionError");
            updatePermission(kind, { name: name, state: "error", supported: true, error: formatted });
            return { name: name, state: "error", supported: true, error: formatted };
        });
    }

    function recordError(operation, error) {
        var formatted = toErrorLike(error, "ClipboardError");
        var timestamp = nowTimestamp();
        state.lastError = {
            operation: operation,
            error: formatted,
            timestamp: timestamp,
        };
        var errorKey = formatted && formatted.name ? formatted.name
            : (formatted && formatted.type ? formatted.type : "Error");
        state.errorCounts[errorKey] = (state.errorCounts[errorKey] || 0) + 1;
        state.metricsUpdatedAt = timestamp;
        schedulePersist();
        return formatted;
    }

    function normalizeText(text) {
        if (typeof text === "string") return text;
        if (text === null || text === undefined) return "";
        return String(text);
    }

    function readText(options) {
        options = options || {};
        var fallbackToCache = options.fallbackToCache !== false;
        var requireGesture = options.requireGesture !== false;
        var permissionInfo;
        return queryPermission("read").then(function(info) {
            permissionInfo = info || { state: "unknown" };
            if (permissionInfo.state === "denied") {
                var deniedError = createError("ClipboardPermissionDenied", "Clipboard read permission denied", {
                    permission: permissionInfo.name,
                    operation: "read",
                });
                dispatchStatus("permission-denied", {
                    operation: "read",
                    permission: permissionInfo.state,
                    message: "Clipboard read permission was denied.",
                });
                recordError("read", deniedError);
                if (fallbackToCache) {
                    return attachSnapshot({
                        text: state.cachedText,
                        fromCache: true,
                        permission: permissionInfo.state,
                        error: toErrorLike(deniedError, "ClipboardPermissionDenied"),
                    });
                }
                throw deniedError;
            }
            if (requireGesture && permissionInfo.state === "prompt" && !getGesture()) {
                var gestureError = createError("ClipboardGestureRequired", "Clipboard read requires a user gesture", {
                    permission: permissionInfo.name,
                    operation: "read",
                });
                dispatchStatus("gesture-required", {
                    operation: "read",
                    permission: permissionInfo.state,
                    message: "Clipboard read requires a focused user gesture.",
                });
                recordError("read", gestureError);
                if (fallbackToCache) {
                    return attachSnapshot({
                        text: state.cachedText,
                        fromCache: true,
                        permission: permissionInfo.state,
                        error: toErrorLike(gestureError, "ClipboardGestureRequired"),
                    });
                }
                throw gestureError;
            }
            if (!clipboardRef || typeof clipboardRef.readText !== "function") {
                var unavailableError = createError("ClipboardUnavailable", "navigator.clipboard.readText is not available", {
                    operation: "read",
                });
                dispatchStatus("unavailable", {
                    operation: "read",
                    permission: permissionInfo.state,
                    message: "Async clipboard read is not supported by this browser.",
                });
                recordError("read", unavailableError);
                if (fallbackToCache) {
                    return attachSnapshot({
                        text: state.cachedText,
                        fromCache: true,
                        permission: permissionInfo.state,
                        error: toErrorLike(unavailableError, "ClipboardUnavailable"),
                    });
                }
                throw unavailableError;
            }
            emit("clipboard.request", { operation: "read", permission: permissionInfo.state });
            return runWithTimeout(function() {
                return clipboardRef.readText();
            }, timeoutMs, "read").then(function(text) {
                var normalized = normalizeText(text);
                var timestamp = nowTimestamp();
                setCachedText(normalized, timestamp);
                state.lastRead = timestamp;
                return attachSnapshot({
                    text: normalized,
                    fromCache: false,
                    permission: permissionInfo.state,
                });
            }).catch(function(error) {
                var formattedError = toErrorLike(error, "ClipboardError");
                dispatchStatus("error", {
                    operation: "read",
                    permission: permissionInfo.state,
                    message: formattedError.message || "Clipboard read failed",
                    error: formattedError,
                });
                recordError("read", error);
                if (fallbackToCache) {
                    return attachSnapshot({
                        text: state.cachedText,
                        fromCache: true,
                        permission: permissionInfo.state,
                        error: formattedError,
                    });
                }
                throw error;
            });
        });
    }

    function writeText(text, options) {
        options = options || {};
        var requireGesture = options.requireGesture !== false;
        var normalized = normalizeText(text);
        var permissionInfo;
        return queryPermission("write").then(function(info) {
            permissionInfo = info || { state: "unknown" };
            if (permissionInfo.state === "denied") {
                var deniedError = createError("ClipboardPermissionDenied", "Clipboard write permission denied", {
                    permission: permissionInfo.name,
                    operation: "write",
                });
                dispatchStatus("permission-denied", {
                    operation: "write",
                    permission: permissionInfo.state,
                    message: "Clipboard write permission was denied.",
                });
                recordError("write", deniedError);
                var deniedTimestamp = nowTimestamp();
                setCachedText(normalized, deniedTimestamp);
                state.lastWrite = deniedTimestamp;
                return attachSnapshot({
                    text: normalized,
                    fromCache: true,
                    permission: permissionInfo.state,
                    error: toErrorLike(deniedError, "ClipboardPermissionDenied"),
                });
            }
            if (requireGesture && permissionInfo.state === "prompt" && !getGesture()) {
                var gestureError = createError("ClipboardGestureRequired", "Clipboard write requires a user gesture", {
                    permission: permissionInfo.name,
                    operation: "write",
                });
                dispatchStatus("gesture-required", {
                    operation: "write",
                    permission: permissionInfo.state,
                    message: "Clipboard write requires a focused user gesture.",
                });
                recordError("write", gestureError);
                var gestureTimestamp = nowTimestamp();
                setCachedText(normalized, gestureTimestamp);
                state.lastWrite = gestureTimestamp;
                return attachSnapshot({
                    text: normalized,
                    fromCache: true,
                    permission: permissionInfo.state,
                    error: toErrorLike(gestureError, "ClipboardGestureRequired"),
                });
            }
            if (!clipboardRef || typeof clipboardRef.writeText !== "function") {
                var unavailableError = createError("ClipboardUnavailable", "navigator.clipboard.writeText is not available", {
                    operation: "write",
                });
                dispatchStatus("unavailable", {
                    operation: "write",
                    permission: permissionInfo.state,
                    message: "Async clipboard write is not supported by this browser.",
                });
                recordError("write", unavailableError);
                var unavailableTimestamp = nowTimestamp();
                setCachedText(normalized, unavailableTimestamp);
                state.lastWrite = unavailableTimestamp;
                return attachSnapshot({
                    text: normalized,
                    fromCache: true,
                    permission: permissionInfo.state,
                    error: toErrorLike(unavailableError, "ClipboardUnavailable"),
                });
            }
            emit("clipboard.request", { operation: "write", permission: permissionInfo.state });
            return runWithTimeout(function() {
                return clipboardRef.writeText(normalized);
            }, timeoutMs, "write").then(function() {
                var timestamp = nowTimestamp();
                setCachedText(normalized, timestamp);
                state.lastWrite = timestamp;
                return attachSnapshot({
                    text: normalized,
                    fromCache: false,
                    permission: permissionInfo.state,
                });
            }).catch(function(error) {
                var formattedError = toErrorLike(error, "ClipboardError");
                dispatchStatus("error", {
                    operation: "write",
                    permission: permissionInfo.state,
                    message: formattedError.message || "Clipboard write failed",
                    error: formattedError,
                });
                recordError("write", error);
                var failureTimestamp = nowTimestamp();
                setCachedText(normalized, failureTimestamp);
                state.lastWrite = failureTimestamp;
                return attachSnapshot({
                    text: normalized,
                    fromCache: true,
                    permission: permissionInfo.state,
                    error: formattedError,
                });
            });
        });
    }

    function getCachedText() {
        return state.cachedText;
    }

    function setCachedText(text, timestamp) {
        var normalized = normalizeText(text);
        var ts = typeof timestamp === "number" && isFinite(timestamp) ? timestamp : nowTimestamp();
        if (state.cachedAt !== null && ts < state.cachedAt) {
            state.staleDrops++;
            return state.cachedText;
        }
        state.cachedText = normalized;
        state.cachedAt = ts;
        return state.cachedText;
    }

    function mergeSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== "object") return getState();
        if (snapshot.permission && typeof snapshot.permission === "object") {
            if (snapshot.permission.read) updatePermission("read", snapshot.permission.read);
            if (snapshot.permission.write) updatePermission("write", snapshot.permission.write);
        }
        if (snapshot.cachedText !== undefined || snapshot.text !== undefined) {
            var nextText = snapshot.cachedText !== undefined ? snapshot.cachedText : snapshot.text;
            if (nextText !== undefined) {
                var ts = typeof snapshot.cachedAt === "number" && isFinite(snapshot.cachedAt)
                    ? snapshot.cachedAt
                    : (typeof snapshot.timestamp === "number" && isFinite(snapshot.timestamp)
                        ? snapshot.timestamp
                        : nowTimestamp());
                setCachedText(nextText, ts);
            }
        }
        if (typeof snapshot.lastRead === "number" && isFinite(snapshot.lastRead) && (!state.lastRead || snapshot.lastRead > state.lastRead)) {
            state.lastRead = snapshot.lastRead;
        }
        if (typeof snapshot.lastWrite === "number" && isFinite(snapshot.lastWrite) && (!state.lastWrite || snapshot.lastWrite > state.lastWrite)) {
            state.lastWrite = snapshot.lastWrite;
        }
        if (snapshot.lastError && typeof snapshot.lastError === "object") {
            if (!state.lastError || !state.lastError.timestamp || (snapshot.lastError.timestamp && snapshot.lastError.timestamp >= state.lastError.timestamp)) {
                state.lastError = Object.assign({}, snapshot.lastError);
            }
        }
        if (snapshot.lastStatus && typeof snapshot.lastStatus === "object") {
            state.lastStatus = Object.assign({}, snapshot.lastStatus);
        }
        if (snapshot.errorCounts && typeof snapshot.errorCounts === "object") {
            var metricsChanged = false;
            Object.keys(snapshot.errorCounts).forEach(function(key) {
                var value = Number(snapshot.errorCounts[key]);
                if (!isFinite(value)) return;
                if (value > (state.errorCounts[key] || 0)) {
                    state.errorCounts[key] = value;
                    metricsChanged = true;
                }
            });
            if (metricsChanged) {
                state.metricsUpdatedAt = nowTimestamp();
                schedulePersist();
            }
        }
        if (typeof snapshot.staleDrops === "number" && snapshot.staleDrops > state.staleDrops) {
            state.staleDrops = snapshot.staleDrops | 0;
        }
        return getState();
    }

    function getState() {
        return {
            cachedText: state.cachedText,
            cachedAt: state.cachedAt,
            lastRead: state.lastRead,
            lastWrite: state.lastWrite,
            lastError: state.lastError ? Object.assign({}, state.lastError) : null,
            permission: {
                read: Object.assign({}, state.permission.read),
                write: Object.assign({}, state.permission.write),
            },
            lastStatus: state.lastStatus ? Object.assign({}, state.lastStatus) : null,
            errorCounts: Object.assign({}, state.errorCounts),
            metricsKey: state.metricsKey,
            metricsUpdatedAt: state.metricsUpdatedAt,
            staleDrops: state.staleDrops,
        };
    }

    function attachSnapshot(base) {
        var snapshot = getState();
        base.cachedAt = snapshot.cachedAt;
        base.lastRead = snapshot.lastRead;
        base.lastWrite = snapshot.lastWrite;
        base.lastStatus = snapshot.lastStatus;
        base.lastErrorDetail = snapshot.lastError;
        base.permissionDetail = snapshot.permission;
        base.staleDrops = snapshot.staleDrops;
        base.errorCounts = snapshot.errorCounts;
        base.metricsKey = snapshot.metricsKey;
        base.metricsUpdatedAt = snapshot.metricsUpdatedAt;
        base.state = snapshot;
        return base;
    }

    return {
        readText: readText,
        writeText: writeText,
        getCachedText: getCachedText,
        setCachedText: setCachedText,
        mergeSnapshot: mergeSnapshot,
        getState: getState,
        attachSnapshot: attachSnapshot,
    };
}

export function createClipboardRequestQueue(executor = {}) {
    if (!executor || typeof executor.read !== "function" || typeof executor.write !== "function") {
        throw new TypeError("createClipboardRequestQueue requires read and write handlers");
    }

    var tail = Promise.resolve();
    var state = {
        pending: 0,
        last: null,
    };

    function enqueue(kind, factory) {
        state.pending++;
        var startedAt = null;
        var run = tail.then(function() {
            startedAt = nowTimestamp();
            return Promise.resolve().then(factory);
        });
        run = run.then(function(result) {
            state.pending--;
            state.last = {
                kind: kind,
                status: "fulfilled",
                result: result,
                startedAt: startedAt,
                finishedAt: nowTimestamp(),
            };
            return result;
        }, function(error) {
            state.pending--;
            state.last = {
                kind: kind,
                status: "rejected",
                error: toErrorLike(error, "ClipboardError"),
                startedAt: startedAt,
                finishedAt: nowTimestamp(),
            };
            throw error;
        });
        tail = run.catch(function() {});
        return run;
    }

    function cloneOptions(options) {
        if (!options || typeof options !== "object") return {};
        var copy = {};
        Object.keys(options).forEach(function(key) {
            copy[key] = options[key];
        });
        return copy;
    }

    return {
        enqueueRead: function(options) {
            var opts = cloneOptions(options);
            return enqueue("read", function() {
                return executor.read.call(executor, opts);
            });
        },
        enqueueWrite: function(text, options) {
            var opts = cloneOptions(options);
            return enqueue("write", function() {
                return executor.write.call(executor, text, opts);
            });
        },
        getState: function() {
            return {
                pending: state.pending,
                last: state.last ? Object.assign({}, state.last) : null,
            };
        },
        clear: function() {
            tail = Promise.resolve();
            state.pending = 0;
            state.last = null;
        },
    };
}

