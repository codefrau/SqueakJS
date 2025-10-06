"use strict";

const DEFAULT_BUFFER_LIMIT = 120;
const channels = Object.create(null);
const dedupeState = Object.create(null);

function getGlobalObject() {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof self !== "undefined") return self;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  return {};
}

function ensureGlobalNamespace() {
  const global = getGlobalObject();
  if (!global.Squeak) global.Squeak = {};
  if (!global.Squeak.TelemetryChannels || typeof global.Squeak.TelemetryChannels !== "object") {
    global.Squeak.TelemetryChannels = {};
  }
  return global.Squeak.TelemetryChannels;
}

function clampBufferLimit(limit) {
  const parsed = Number(limit);
  if (!isFinite(parsed) || parsed <= 0) return DEFAULT_BUFFER_LIMIT;
  return Math.max(1, Math.round(parsed));
}

function normalizeVersion(version, fallback) {
  const parsed = Number(version);
  if (!isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function getTelemetryEmitter() {
  const global = getGlobalObject();
  const squeak = global && global.Squeak;
  if (!squeak || typeof squeak !== "object") return null;
  const telemetry = squeak.telemetry;
  if (!telemetry || typeof telemetry.emit !== "function") return null;
  return telemetry;
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

function normalizeError(error) {
  if (!error) return null;
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  const formatted = {
    name: error && error.name ? error.name : "Error",
    message: error && error.message ? error.message : String(error)
  };
  if (error.code !== undefined) formatted.code = error.code;
  if (error.type !== undefined) formatted.type = error.type;
  if (error.reason !== undefined) formatted.reason = error.reason;
  return formatted;
}

export function configureTelemetryChannel(namespace, config) {
  if (!namespace || typeof namespace !== "string") {
    throw new Error("Telemetry channel requires a namespace string");
  }
  const key = namespace.trim();
  if (!key) {
    throw new Error("Telemetry channel namespace cannot be empty");
  }
  let channel = channels[key];
  if (!channel) {
    channel = {
      namespace: key,
      version: 1,
      bufferLimit: DEFAULT_BUFFER_LIMIT,
      history: []
    };
    channels[key] = channel;
  }
  if (config && typeof config === "object") {
    if (config.version !== undefined) {
      channel.version = normalizeVersion(config.version, channel.version);
    }
    if (config.bufferLimit !== undefined) {
      channel.bufferLimit = clampBufferLimit(config.bufferLimit);
    }
  }
  ensureGlobalNamespace()[key] = channel;
  return channel;
}

export function getTelemetryChannelState(namespace) {
  return namespace && channels[namespace] ? channels[namespace] : null;
}

function ensureDedupeBucket(namespace) {
  if (!dedupeState[namespace]) {
    dedupeState[namespace] = Object.create(null);
  }
  return dedupeState[namespace];
}

function rememberDedupeSignature(namespace, scope, signature) {
  const bucket = ensureDedupeBucket(namespace);
  bucket[scope] = signature;
}

function isDuplicate(namespace, scope, signature) {
  const bucket = ensureDedupeBucket(namespace);
  return bucket[scope] === signature;
}

export function resetTelemetryChannels(namespaces) {
  const keys = namespaces
    ? (Array.isArray(namespaces) ? namespaces : [namespaces])
    : Object.keys(channels);
  const registry = ensureGlobalNamespace();
  for (const key of keys) {
    const channel = channels[key];
    if (!channel) continue;
    channel.history.length = 0;
    if (dedupeState[key]) {
      dedupeState[key] = Object.create(null);
    }
    registry[key] = channel;
  }
}

export function emitTelemetryEvent(namespace, type, payload, options) {
  const channel = configureTelemetryChannel(namespace, options);
  const eventType = typeof type === "string" && type.trim() ? type.trim() : "event";
  const envelope = {
    namespace: channel.namespace,
    type: eventType,
    version: options && options.version !== undefined
      ? normalizeVersion(options.version, channel.version)
      : channel.version,
    timestamp: Date.now(),
    payload: payload && typeof payload === "object" ? payload : (payload === undefined ? {} : { value: payload })
  };
  if (options && options.tags !== undefined) envelope.tags = options.tags;
  if (options && options.context !== undefined) envelope.context = options.context;

  const dedupeKey = options && options.dedupeKey;
  if (dedupeKey !== undefined && dedupeKey !== null) {
    let signature = dedupeKey;
    if (typeof signature !== "string") {
      try {
        signature = JSON.stringify(signature);
      } catch (_) {
        signature = String(signature);
      }
    }
    const scope = options && options.dedupeScope ? String(options.dedupeScope) : eventType;
    if (signature && isDuplicate(channel.namespace, scope, signature)) {
      return false;
    }
    if (signature) {
      rememberDedupeSignature(channel.namespace, scope, signature);
    }
  }

  channel.history.push(envelope);
  if (channel.history.length > channel.bufferLimit) {
    channel.history.splice(0, channel.history.length - channel.bufferLimit);
  }

  const eventName = options && options.eventName ? options.eventName : `${channel.namespace}.${eventType}`;
  const emitter = getTelemetryEmitter();
  if (emitter) {
    try {
      emitter.emit(eventName, envelope);
      return true;
    } catch (error) {
      const prefix = options && options.consolePrefix ? options.consolePrefix : "[SqueakJS][telemetry]";
      logToConsole("warn", `${prefix} emit failed (${eventName})`, {
        error: normalizeError(error),
        event: envelope
      });
    }
  }
  const fallbackLevel = options && options.fallbackLevel ? options.fallbackLevel : "info";
  const prefix = options && options.consolePrefix ? options.consolePrefix : "[SqueakJS][telemetry]";
  logToConsole(fallbackLevel, `${prefix} ${eventName}`, envelope);
  return false;
}

export { normalizeError as formatTelemetryError };
