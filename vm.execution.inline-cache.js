"use strict";

import { emitTelemetryEvent } from "./vm.telemetry.channel.js";

const DEFAULT_NAMESPACE = "vm.inlineCache";
const DEFAULT_SAMPLE_INTERVAL = 500;
const MAX_SAMPLE_BUFFER = 32;

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.round(parsed));
}

function normalizeProbeDepth(depth) {
  const parsed = Number(depth);
  if (!isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.round(parsed));
}

function normalizeSendEvent(event) {
  if (!event || typeof event !== "object") return null;
  const normalized = {
    argCount: typeof event.argCount === "number" ? Math.max(0, Math.round(event.argCount)) : null,
    super: !!event.super,
    opcode: event.opcode !== undefined ? event.opcode : null
  };
  if (event.selectorId !== undefined) normalized.selectorId = event.selectorId;
  else if (event.selectorHash !== undefined) normalized.selectorHash = event.selectorHash;
  else if (typeof event.selector === "string" || typeof event.selector === "number") normalized.selectorId = event.selector;
  if (event.classId !== undefined) normalized.classId = event.classId;
  if (event.receiverClassId !== undefined) normalized.receiverClassId = event.receiverClassId;
  return normalized;
}

function snapshotMetrics(state) {
  const histogram = Object.create(null);
  for (const [depth, count] of state.probeHistogram.entries()) {
    histogram[depth] = count;
  }
  return {
    lookups: state.lookups,
    hits: state.hits,
    misses: state.misses,
    evictions: state.evictions,
    probeHistogram: histogram,
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
    lastOpcode: state.lastOpcode ? { ...state.lastOpcode } : null,
    recentSendSites: state.recentSendSites.slice()
  };
}

export function createInlineCacheMonitor(config = {}) {
  const namespace = typeof config.namespace === "string" && config.namespace.trim()
    ? config.namespace.trim()
    : DEFAULT_NAMESPACE;
  const sampleInterval = config.sampleInterval === 0
    ? 0
    : toPositiveInteger(config.sampleInterval, DEFAULT_SAMPLE_INTERVAL);
  const telemetryVersion = config.version !== undefined ? toPositiveInteger(config.version, 1) : 1;
  const emit = typeof config.emit === "function"
    ? config.emit
    : (config.disableTelemetry ? null : emitTelemetryEvent);
  const telemetryOptions = {
    version: telemetryVersion,
    dedupeScope: "lookup",
    dedupeKey: null,
    fallbackLevel: "debug"
  };

  const state = {
    lookups: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
    probeHistogram: new Map(),
    lastEvent: null,
    lastOpcode: null,
    recentSendSites: []
  };

  function recordProbe(kind, probeDepth, metadata) {
    state.lookups += 1;
    const normalizedDepth = normalizeProbeDepth(probeDepth);
    if (normalizedDepth !== null) {
      state.probeHistogram.set(
        normalizedDepth,
        (state.probeHistogram.get(normalizedDepth) || 0) + 1
      );
    }
    if (kind === "hit") state.hits += 1;
    else if (kind === "miss") state.misses += 1;
    if (metadata && metadata.evicted) state.evictions += 1;
    state.lastEvent = {
      kind,
      probeDepth: normalizedDepth,
      evicted: !!(metadata && metadata.evicted),
      selectorId: metadata && metadata.selectorId !== undefined ? metadata.selectorId : undefined,
      selectorHash: metadata && metadata.selectorHash !== undefined ? metadata.selectorHash : undefined,
      classId: metadata && metadata.classId !== undefined ? metadata.classId : undefined,
      timestamp: Date.now()
    };
    if (emit && sampleInterval && state.lookups % sampleInterval === 0) {
      try {
        emit(
          namespace,
          "sample",
          {
            metrics: snapshotMetrics(state),
            event: state.lastEvent
          },
          {
            ...telemetryOptions,
            dedupeKey: state.lastEvent ? `${state.lastEvent.kind}:${state.lookups}` : state.lookups
          }
        );
      } catch (_) {
        // ignore emission errors
      }
    }
  }

  function recordHit(probeDepth, metadata) {
    recordProbe("hit", probeDepth, metadata);
  }

  function recordMiss(probeDepth, metadata) {
    recordProbe("miss", probeDepth, metadata);
  }

  function recordEviction(metadata) {
    recordProbe("miss", 0, { ...(metadata || {}), evicted: true });
  }

  function onOpcode(event) {
    if (!event || typeof event !== "object") return;
    state.lastOpcode = {
      opcode: event.opcode !== undefined ? event.opcode : null,
      singleStep: !!event.singleStep,
      timestamp: Date.now()
    };
  }

  function recordSendSite(event) {
    const normalized = normalizeSendEvent(event);
    if (!normalized) return;
    normalized.timestamp = Date.now();
    state.recentSendSites.push(normalized);
    if (state.recentSendSites.length > MAX_SAMPLE_BUFFER) {
      state.recentSendSites.splice(0, state.recentSendSites.length - MAX_SAMPLE_BUFFER);
    }
  }

  function reset() {
    state.lookups = 0;
    state.hits = 0;
    state.misses = 0;
    state.evictions = 0;
    state.probeHistogram.clear();
    state.lastEvent = null;
    state.lastOpcode = null;
    state.recentSendSites.length = 0;
  }

  function snapshot() {
    return snapshotMetrics(state);
  }

  return {
    recordHit,
    recordMiss,
    recordEviction,
    onOpcode,
    recordSendSite,
    reset,
    snapshot
  };
}
