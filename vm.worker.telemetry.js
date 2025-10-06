"use strict";

import {
  configureTelemetryChannel,
  emitTelemetryEvent,
  getTelemetryChannelState,
  resetTelemetryChannels
} from "./vm.telemetry.channel.js";

const WORKER_TELEMETRY_NAMESPACE = "worker.integration";

function ensureChannel(config) {
  return configureTelemetryChannel(WORKER_TELEMETRY_NAMESPACE, config);
}

function isPlainObject(value) {
  return !!value && Object.prototype.toString.call(value) === "[object Object]";
}

function sanitizeError(error) {
  if (!error) {
    return null;
  }
  if (typeof error === "string") {
    return { message: error };
  }
  if (!isPlainObject(error)) {
    return { message: String(error) };
  }
  const payload = {};
  if (error.message !== undefined) payload.message = String(error.message);
  if (error.code !== undefined) payload.code = String(error.code);
  if (error.type !== undefined) payload.type = String(error.type);
  if (error.reason !== undefined) payload.reason = String(error.reason);
  if (error.severity !== undefined) payload.severity = String(error.severity);
  if (Object.keys(payload).length === 0) {
    payload.message = String(error);
  }
  return payload;
}

function sanitizeThrottling(throttling) {
  if (!isPlainObject(throttling)) {
    return null;
  }
  const payload = {};
  if (throttling.state !== undefined) payload.state = String(throttling.state);
  if (throttling.reason !== undefined) payload.reason = String(throttling.reason);
  const numericKeys = [
    "budget",
    "remaining",
    "interval",
    "cooldownMs",
    "requests",
    "resets",
    "latencyMs"
  ];
  for (const key of numericKeys) {
    const value = throttling[key];
    if (Number.isFinite(value)) {
      payload[key] = value;
    }
  }
  if (throttling.lastResetAt !== undefined && Number.isFinite(throttling.lastResetAt)) {
    payload.lastResetAt = throttling.lastResetAt;
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

function buildMetrics(detail) {
  const metrics = {};
  if (Number.isFinite(detail.roundTripMs)) {
    metrics.roundTripMs = detail.roundTripMs;
  }
  if (Number.isFinite(detail.detectionDurationMs)) {
    metrics.detectionDurationMs = detail.detectionDurationMs;
  }
  if (Number.isFinite(detail.workerErrors)) {
    metrics.workerErrors = detail.workerErrors;
  }
  if (Number.isFinite(detail.timeoutCount)) {
    metrics.timeoutCount = detail.timeoutCount;
  }
  if (Number.isFinite(detail.mainThreadDependencyCount)) {
    metrics.mainThreadDependencyCount = detail.mainThreadDependencyCount;
  }
  if (detail.resourceCapabilityError) {
    metrics.resourceCapabilityError = 1;
  }
  const throttling = sanitizeThrottling(detail.throttling);
  if (throttling) {
    if (Number.isFinite(throttling.budget)) metrics.throttlingBudget = throttling.budget;
    if (Number.isFinite(throttling.remaining)) metrics.throttlingRemaining = throttling.remaining;
    if (Number.isFinite(throttling.interval)) metrics.throttlingInterval = throttling.interval;
    if (Number.isFinite(throttling.latencyMs)) metrics.throttlingLatencyMs = throttling.latencyMs;
    if (Number.isFinite(throttling.cooldownMs)) metrics.throttlingCooldownMs = throttling.cooldownMs;
    if (Number.isFinite(throttling.requests)) metrics.throttlingRequests = throttling.requests;
    if (Number.isFinite(throttling.resets)) metrics.throttlingResets = throttling.resets;
    if (throttling.lastResetAt !== undefined) metrics.throttlingLastResetAt = throttling.lastResetAt;
  }
  return metrics;
}

export function recordWorkerFeatureReportEvent(detail = {}) {
  ensureChannel();
  const throttling = sanitizeThrottling(detail.throttling);
  const errors = Array.isArray(detail.errors)
    ? detail.errors.map(sanitizeError).filter(Boolean)
    : [];
  const capabilityError = sanitizeError(detail.resourceCapabilityError);
  const metrics = buildMetrics({
    ...detail,
    throttling,
    resourceCapabilityError: capabilityError
  });
  const detection = {};
  if (detail.detectionStatus) {
    detection.status = detail.detectionStatus;
  }
  if (Number.isFinite(detail.detectionDurationMs)) {
    detection.durationMs = detail.detectionDurationMs;
  }
  const payload = {
    requestId: detail.requestId ?? null,
    status: detail.status || (capabilityError ? "degraded" : "ok"),
    throttling: throttling || null,
    errors,
    metrics
  };
  if (capabilityError) {
    payload.resourceCapabilityError = capabilityError;
  }
  if (Object.keys(detection).length > 0) {
    payload.detection = detection;
  }
  emitTelemetryEvent(WORKER_TELEMETRY_NAMESPACE, "feature-report", payload, {
    version: detail.version || 1,
    fallbackLevel: detail.fallbackLevel || "debug",
    context: detail.context,
    tags: detail.tags
  });
}

export function resetWorkerTelemetry(config) {
  if (config) {
    ensureChannel(config);
  }
  resetTelemetryChannels(WORKER_TELEMETRY_NAMESPACE);
}

export function configureWorkerTelemetry(config) {
  return ensureChannel(config);
}

export function getWorkerTelemetryChannelState() {
  ensureChannel();
  return getTelemetryChannelState(WORKER_TELEMETRY_NAMESPACE);
}

export { WORKER_TELEMETRY_NAMESPACE };
