"use strict";

import {
  configureTelemetryChannel,
  emitTelemetryEvent
} from "./vm.telemetry.channel.js";

export const EXECUTION_PROFILER_NAMESPACE = "execution.profile";
const DEFAULT_BUFFER_LIMIT = 2000;
const DEFAULT_TELEMETRY_VERSION = 1;

function isFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number);
}

function toNonNegativeInteger(value) {
  if (!isFiniteNumber(value)) {
    return null;
  }
  const integer = Math.floor(Math.abs(Number(value)));
  return Number.isFinite(integer) ? integer : null;
}

function sanitizeSelector(detail) {
  if (!detail) {
    return {};
  }
  const payload = {};
  if (typeof detail.selector === "string") {
    payload.selector = detail.selector;
  } else if (detail.selector && typeof detail.selector === "object") {
    if (typeof detail.selector.selector === "string" && detail.selector.selector) {
      payload.selector = detail.selector.selector;
    } else if (typeof detail.selector.string === "string" && detail.selector.string) {
      payload.selector = detail.selector.string;
    } else if (typeof detail.selector.value === "string" && detail.selector.value) {
      payload.selector = detail.selector.value;
    }
    if (isFiniteNumber(detail.selector.hash)) {
      payload.selectorHash = Number(detail.selector.hash);
    }
  }
  if (detail.selectorId !== undefined && detail.selectorId !== null) {
    payload.selectorId = detail.selectorId;
  }
  if (!payload.selector && payload.selectorHash === undefined && payload.selectorId === undefined) {
    payload.selectorId = null;
  }
  return payload;
}

function sanitizeSendPayload(detail) {
  const payload = sanitizeSelector(detail);
  const argCount = toNonNegativeInteger(detail && detail.argCount);
  payload.argCount = argCount !== null ? argCount : null;
  payload.super = !!(detail && detail.super);
  if (detail && detail.special === true) {
    payload.special = true;
  }
  if (detail && detail.quickFallback) {
    payload.quickFallback = true;
  }
  if (isFiniteNumber(detail && detail.opcode)) {
    payload.opcode = Number(detail.opcode);
  } else {
    payload.opcode = null;
  }
  return payload;
}

function sanitizePrimitivePayload(detail) {
  const payload = {};
  if (isFiniteNumber(detail && detail.index)) {
    payload.index = Number(detail.index);
  } else {
    payload.index = null;
  }
  if (isFiniteNumber(detail && detail.opcode)) {
    payload.opcode = Number(detail.opcode);
  } else {
    payload.opcode = null;
  }
  return payload;
}

function sanitizeGCPayload(detail) {
  const payload = {
    kind: detail && typeof detail.kind === "string" ? detail.kind : "unknown",
    reason: detail && typeof detail.reason === "string" ? detail.reason : null,
    durationMs: isFiniteNumber(detail && detail.durationMs) ? Number(detail.durationMs) : null
  };
  if (detail && detail.stats && typeof detail.stats === "object") {
    const stats = {};
    for (const [key, value] of Object.entries(detail.stats)) {
      if (isFiniteNumber(value)) {
        stats[key] = Number(value);
      }
    }
    if (Object.keys(stats).length > 0) {
      payload.stats = stats;
    }
  }
  return payload;
}

function sanitizeBackendPayload(detail) {
  const payload = {
    previous: detail && typeof detail.previous === "string" ? detail.previous : (detail && detail.previous) || null,
    next: detail && typeof detail.next === "string" ? detail.next : (detail && detail.next) || null
  };
  if (detail && detail.requested) {
    payload.requested = detail.requested;
  }
  if (detail && detail.reason) {
    payload.reason = detail.reason;
  }
  return payload;
}

function mergeMetadata(target, metadata) {
  if (!metadata) return target;
  if (metadata.vmId !== undefined && target.vmId === undefined) {
    target.vmId = metadata.vmId;
  }
  if (metadata.sessionId !== undefined && target.sessionId === undefined) {
    target.sessionId = metadata.sessionId;
  }
  if (metadata.runId !== undefined && target.runId === undefined) {
    target.runId = metadata.runId;
  }
  return target;
}

export function createExecutionProfiler(options = {}) {
  const config = options && typeof options === "object" ? options : {};
  const disabled = config.disabled === true || config.enabled === false;
  const bufferLimit = toNonNegativeInteger(config.bufferLimit) || DEFAULT_BUFFER_LIMIT;
  const sinks = Array.isArray(config.sinks) ? config.sinks.filter((sink) => typeof sink === "function") : [];
  const metadata = config.metadata && typeof config.metadata === "object" ? { ...config.metadata } : {};
  const telemetryConfig = config.telemetry && typeof config.telemetry === "object" ? config.telemetry : null;
  const namespace = telemetryConfig && typeof telemetryConfig.namespace === "string"
    ? telemetryConfig.namespace
    : (config.namespace || EXECUTION_PROFILER_NAMESPACE);

  let telemetryEnabled = false;
  if (!disabled && telemetryConfig && telemetryConfig.disabled !== true) {
    try {
      configureTelemetryChannel(namespace, {
        version: telemetryConfig.version || DEFAULT_TELEMETRY_VERSION,
        bufferLimit: telemetryConfig.bufferLimit
      });
      telemetryEnabled = true;
    } catch (_) {
      telemetryEnabled = false;
    }
  }

  const buffer = [];
  let attachedVM = config.vm && typeof config.vm === "object" ? config.vm : null;
  let lastOpcode = null;

  function pushEvent(event) {
    if (disabled) {
      return null;
    }
    const entry = {
      type: event.type,
      timestamp: event.timestamp || Date.now(),
      payload: mergeMetadata(event.payload ? { ...event.payload } : {}, metadata)
    };
    buffer.push(entry);
    if (buffer.length > bufferLimit) {
      buffer.splice(0, buffer.length - bufferLimit);
    }
    for (const sink of sinks) {
      try {
        sink(entry);
      } catch (_) {
        // ignore sink failures
      }
    }
    if (telemetryEnabled) {
      try {
        emitTelemetryEvent(namespace, event.type, entry.payload, {
          version: telemetryConfig.version || DEFAULT_TELEMETRY_VERSION,
          context: telemetryConfig.context,
          tags: telemetryConfig.tags,
          dedupeKey: telemetryConfig.dedupeKey
        });
      } catch (_) {
        // ignore telemetry failures
      }
    }
    return entry;
  }

  function recordSend(detail, special) {
    const payload = sanitizeSendPayload({ ...detail, special });
    if (attachedVM && payload.vmId === undefined && metadata.vmId === undefined) {
      payload.vmId = attachedVM.vmId || attachedVM.id || null;
    }
    return pushEvent({ type: "send", payload });
  }

  function recordPrimitive(detail) {
    const payload = sanitizePrimitivePayload(detail);
    if (attachedVM && payload.vmId === undefined && metadata.vmId === undefined) {
      payload.vmId = attachedVM.vmId || attachedVM.id || null;
    }
    return pushEvent({ type: "primitive", payload });
  }

  function recordGC(detail) {
    const payload = sanitizeGCPayload(detail);
    return pushEvent({ type: "gc", payload });
  }

  function recordBackendSwitch(detail) {
    const payload = sanitizeBackendPayload(detail);
    return pushEvent({ type: "backend", payload });
  }

  function createDispatchHooks() {
    return {
      beforeOpcode(event) {
        if (event && event.opcode !== undefined) {
          lastOpcode = event.opcode;
        }
      },
      onSend(event) {
        const payload = { ...event };
        if (payload.opcode === undefined && lastOpcode !== null) {
          payload.opcode = lastOpcode;
        }
        recordSend(payload, false);
      },
      onSendSpecial(event) {
        const payload = { ...event, special: true };
        if (payload.opcode === undefined && lastOpcode !== null) {
          payload.opcode = lastOpcode;
        }
        recordSend(payload, true);
      },
      onPrimitiveCall(event) {
        const payload = { ...event };
        if (payload.opcode === undefined && lastOpcode !== null) {
          payload.opcode = lastOpcode;
        }
        recordPrimitive(payload);
      }
    };
  }

  function flush() {
    const events = buffer.slice();
    buffer.length = 0;
    return events;
  }

  function summarize() {
    const summary = {
      totalEvents: buffer.length,
      typeCounts: {}
    };
    for (const event of buffer) {
      const key = event.type || "unknown";
      summary.typeCounts[key] = (summary.typeCounts[key] || 0) + 1;
    }
    return summary;
  }

  return {
    get enabled() {
      return !disabled;
    },
    setVM(vm) {
      if (vm && typeof vm === "object") {
        attachedVM = vm;
      }
    },
    recordSend,
    recordPrimitive,
    recordGC,
    recordBackendSwitch,
    createDispatchHooks,
    flush,
    summarize,
    getEvents() {
      return buffer.slice();
    }
  };
}
