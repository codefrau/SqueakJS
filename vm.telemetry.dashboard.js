"use strict";

import { getTelemetryChannelState } from "./vm.telemetry.channel.js";

function getGlobalObject() {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof self !== "undefined") return self;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  return {};
}

function getTelemetryRegistry() {
  const global = getGlobalObject();
  if (!global || typeof global !== "object") return {};
  const squeak = global.Squeak;
  if (!squeak || typeof squeak !== "object") return {};
  const registry = squeak.TelemetryChannels;
  if (!registry || typeof registry !== "object") return {};
  return registry;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isPlainObject(value) {
  return !!value && Object.prototype.toString.call(value) === "[object Object]";
}

function recordNumericMetric(target, key, value) {
  if (!Number.isFinite(value)) {
    return;
  }
  const entry = target[key] || { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, last: null };
  entry.count += 1;
  entry.sum += value;
  if (value < entry.min) entry.min = value;
  if (value > entry.max) entry.max = value;
  entry.last = value;
  entry.mean = entry.sum / entry.count;
  target[key] = entry;
}

function collectNumericMetrics(node, target, prefix) {
  if (!node) return;
  if (typeof node === "number") {
    recordNumericMetric(target, prefix || "value", node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
      collectNumericMetrics(item, target, path);
    });
    return;
  }
  if (!isPlainObject(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number") {
      recordNumericMetric(target, path, value);
    } else if (value !== null && (Array.isArray(value) || isPlainObject(value))) {
      collectNumericMetrics(value, target, path);
    }
  }
}

function summarizeChannel(namespace, state) {
  const history = state && Array.isArray(state.history) ? state.history : [];
  const summary = {
    namespace,
    version: state && state.version !== undefined ? state.version : null,
    eventCount: history.length,
    firstTimestamp: null,
    lastTimestamp: null,
    durationMs: null,
    eventsPerSecond: null,
    types: {},
    metrics: {}
  };

  for (const envelope of history) {
    if (!envelope || typeof envelope !== "object") continue;
    const { type, timestamp, payload } = envelope;
    if (typeof type === "string" && type) {
      summary.types[type] = (summary.types[type] || 0) + 1;
    }
    if (Number.isFinite(timestamp)) {
      if (summary.firstTimestamp === null || timestamp < summary.firstTimestamp) {
        summary.firstTimestamp = timestamp;
      }
      if (summary.lastTimestamp === null || timestamp > summary.lastTimestamp) {
        summary.lastTimestamp = timestamp;
      }
    }
    if (payload && typeof payload === "object") {
      if (payload.metrics !== undefined) {
        collectNumericMetrics(payload.metrics, summary.metrics, "metrics");
      }
      if (payload.value !== undefined) {
        collectNumericMetrics(payload.value, summary.metrics, "value");
      }
    }
  }

  if (summary.eventCount > 1 && summary.firstTimestamp !== null && summary.lastTimestamp !== null) {
    summary.durationMs = Math.max(0, summary.lastTimestamp - summary.firstTimestamp);
    if (summary.durationMs > 0) {
      summary.eventsPerSecond = summary.eventCount / (summary.durationMs / 1000);
    } else {
      summary.eventsPerSecond = null;
    }
  }

  return summary;
}

export function summarizeTelemetry(namespaces) {
  const registry = getTelemetryRegistry();
  const requested = namespaces ? toArray(namespaces) : Object.keys(registry);
  const unique = Array.from(new Set(requested.filter((name) => typeof name === "string" && name.trim())));

  const summaries = [];
  for (const name of unique) {
    const state = getTelemetryChannelState(name);
    if (!state) continue;
    summaries.push(summarizeChannel(name, state));
  }

  return {
    generatedAt: Date.now(),
    namespaces: summaries
  };
}

function inferMetricPolicy(metricName, overrides) {
  if (overrides && overrides[metricName]) {
    return overrides[metricName];
  }
  const lowerIsBetterPattern = /(time|latency|duration|miss|evict|stall|error|drop)/i;
  return {
    higherIsBetter: !lowerIsBetterPattern.test(metricName)
  };
}

export function compareTelemetrySummaries(current, baseline, options = {}) {
  if (!current || !baseline || !Array.isArray(current.namespaces) || !Array.isArray(baseline.namespaces)) {
    return { regressions: [] };
  }
  const baselineIndex = new Map(baseline.namespaces.map((entry) => [entry.namespace, entry]));
  const threshold = Number.isFinite(options.threshold) ? Math.max(0, options.threshold) : 0.1;
  const policies = options.metricPolicies || {};

  const regressions = [];

  for (const namespaceSummary of current.namespaces) {
    if (!namespaceSummary || !namespaceSummary.namespace) continue;
    const baselineSummary = baselineIndex.get(namespaceSummary.namespace);
    if (!baselineSummary) continue;
    const metrics = namespaceSummary.metrics || {};
    for (const [metricName, metricStats] of Object.entries(metrics)) {
      const baselineStats = baselineSummary.metrics ? baselineSummary.metrics[metricName] : null;
      if (!baselineStats || !baselineStats.count || !Number.isFinite(baselineStats.sum)) continue;
      if (!metricStats || !metricStats.count || !Number.isFinite(metricStats.sum)) continue;

      const currentMean = metricStats.sum / metricStats.count;
      const baselineMean = baselineStats.sum / baselineStats.count;
      if (!Number.isFinite(currentMean) || !Number.isFinite(baselineMean) || baselineMean === 0) continue;

      const change = (currentMean - baselineMean) / baselineMean;
      const policy = inferMetricPolicy(metricName, policies);
      const higherIsBetter = !!policy.higherIsBetter;
      const severity = Math.abs(change);
      const regressed = higherIsBetter ? change <= -threshold : change >= threshold;

      if (severity >= threshold) {
        regressions.push({
          namespace: namespaceSummary.namespace,
          metric: metricName,
          baselineMean,
          currentMean,
          percentChange: change,
          regressed,
          higherIsBetter
        });
      }
    }
  }

  return { regressions };
}
