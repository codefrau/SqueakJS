"use strict";

import {
  configureTelemetryChannel,
  emitTelemetryEvent
} from "./vm.telemetry.channel.js";

export const MANAGED_JIT_TELEMETRY_NAMESPACE = "execution.jit";
const DEFAULT_TELEMETRY_VERSION = 1;
const DEFAULT_SLOW_MACHINE_THRESHOLD = 10;

function isFiniteNumber(value) {
  return typeof value === "number" && isFinite(value);
}

function summarizeCapability(capability) {
  if (!capability || typeof capability !== "object") {
    return null;
  }
  const summary = {
    id: capability.id || null,
    label: capability.label || null,
    supported: capability.supported === true,
    reason: capability.reason || null,
    requiresGesture: capability.requiresGesture === true,
  };
  if (capability.permission && typeof capability.permission === "object") {
    summary.permission = {
      state: capability.permission.state || null,
      reason: capability.permission.reason || null,
      source: capability.permission.source || null,
      lastChecked: capability.permission.lastChecked || null,
    };
  }
  if (capability.lastUpdated) summary.lastUpdated = capability.lastUpdated;
  if (capability.details) summary.details = capability.details;
  if (capability.error) summary.error = sanitizeError(capability.error);
  return summary;
}

export function getDynamicCodeCapability(capabilities) {
  if (!capabilities) {
    return null;
  }
  if (capabilities.dynamicCode && typeof capabilities.dynamicCode === "object") {
    return capabilities.dynamicCode;
  }
  if (capabilities.execution && typeof capabilities.execution === "object") {
    const execution = capabilities.execution;
    if (execution.dynamicCode && typeof execution.dynamicCode === "object") {
      return execution.dynamicCode;
    }
  }
  if (capabilities.resource && capabilities.resource.groups) {
    const executionGroup = capabilities.resource.groups.execution;
    if (executionGroup && executionGroup.dynamicCode) {
      return executionGroup.dynamicCode;
    }
  }
  if (capabilities.groups && capabilities.groups.execution && capabilities.groups.execution.dynamicCode) {
    return capabilities.groups.execution.dynamicCode;
  }
  return null;
}

function sanitizeError(error) {
  if (!error) {
    return null;
  }
  if (typeof error === "string") {
    return { message: error };
  }
  if (typeof error !== "object") {
    return { message: String(error) };
  }
  const payload = {};
  if (error.name !== undefined) payload.name = String(error.name);
  if (error.message !== undefined) payload.message = String(error.message);
  if (error.code !== undefined) payload.code = String(error.code);
  if (error.type !== undefined) payload.type = String(error.type);
  if (error.reason !== undefined) payload.reason = String(error.reason);
  if (Object.keys(payload).length === 0) {
    payload.message = String(error);
  }
  return payload;
}

function getSqueakNamespace(vm) {
  if (vm && vm.Squeak) {
    return vm.Squeak;
  }
  if (typeof Squeak !== "undefined") {
    return Squeak;
  }
  return null;
}

function computeObjectsPerMillisecond(vm) {
  if (!vm || !vm.image) {
    return null;
  }
  const oldSpaceCount = Number(vm.image.oldSpaceCount);
  const startup = Number(vm.image.startupTime);
  const now = Number(vm.startupTime);
  if (!isFinite(oldSpaceCount) || !isFinite(startup) || !isFinite(now)) {
    return null;
  }
  const duration = now - startup;
  if (duration <= 0) {
    return null;
  }
  return oldSpaceCount / duration;
}

function normalizePolicyDecision(decision, fallbackReason) {
  if (decision === undefined || decision === null) {
    return { allowed: true };
  }
  if (typeof decision === "boolean") {
    return { allowed: decision };
  }
  if (typeof decision !== "object") {
    return { allowed: !!decision };
  }
  const allowed = decision.allowed !== false;
  const normalized = {
    allowed,
    reason: allowed ? null : (decision.reason || fallbackReason),
    detail: decision.detail || null,
    message: decision.message || null
  };
  if (decision.metrics) {
    normalized.metrics = decision.metrics;
  }
  return normalized;
}

export function createManagedJITController(config = {}) {
  const vm = config.vm;
  if (!vm) {
    throw new Error("Managed JIT controller requires a vm instance");
  }

  const policy = config.policy && typeof config.policy === "object" ? config.policy : {};
  const telemetryOptions = config.telemetry && typeof config.telemetry === "object"
    ? config.telemetry
    : {};
  const telemetryNamespace = telemetryOptions.namespace || MANAGED_JIT_TELEMETRY_NAMESPACE;
  const telemetryVersion = telemetryOptions.version !== undefined
    ? telemetryOptions.version
    : DEFAULT_TELEMETRY_VERSION;
  const telemetryDisabled = telemetryOptions.disabled === true;

  if (!telemetryDisabled) {
    configureTelemetryChannel(telemetryNamespace, {
      version: telemetryVersion,
      bufferLimit: telemetryOptions.bufferLimit
    });
  }

  function emitTelemetry(type, payload, options) {
    if (telemetryDisabled) {
      return;
    }
    try {
      emitTelemetryEvent(telemetryNamespace, type, payload, {
        version: telemetryVersion,
        tags: telemetryOptions.tags,
        context: telemetryOptions.context,
        dedupeKey: options && options.dedupeKey !== undefined ? options.dedupeKey : undefined
      });
    } catch (_) {
      // ignore telemetry errors
    }
  }

  function finalizeFailure(reason, detail, message) {
    emitTelemetry("jit-disabled", {
      reason,
      detail: detail || null
    }, { dedupeKey: reason });
    return {
      enabled: false,
      reason,
      detail: detail || null,
      message: message || null
    };
  }

  function finalizeSuccess(compiler, metrics, message) {
    emitTelemetry("jit-enabled", {
      metrics: metrics || null
    }, { dedupeKey: "jit-enabled" });
    return {
      enabled: true,
      compiler,
      metrics: metrics || null,
      message: message || null
    };
  }

  function checkDynamicCodeAllowance() {
    const capability = getDynamicCodeCapability(config.capabilities);
    if (capability) {
      const summary = summarizeCapability(capability);
      if (capability.supported === false) {
        return {
          allowed: false,
          reason: "dynamic-code-capability",
          detail: { capability: summary },
          message: capability.message || capability.reason || "Managed JIT disabled: capability reported dynamic code unsupported"
        };
      }
      const permission = capability.permission;
      if (permission && (permission.state === "denied" || permission.state === "blocked")) {
        return {
          allowed: false,
          reason: "dynamic-code-capability",
          detail: { capability: summary },
          message: capability.message || "Managed JIT disabled: dynamic code permission denied"
        };
      }
    }

    if (typeof policy.allowDynamicCode === "function") {
      const decision = normalizePolicyDecision(
        policy.allowDynamicCode({
          vm,
          capabilities: config.capabilities || vm.negotiatedCapabilities || null
        }),
        "dynamic-code-policy"
      );
      if (!decision.allowed) {
        return {
          allowed: false,
          reason: "dynamic-code-policy",
          detail: decision.detail,
          message: decision.message
        };
      }
      if (decision.metrics) {
        return { allowed: true, detail: { policyMetrics: decision.metrics } };
      }
    }

    if (typeof policy.dynamicProbe === "function") {
      const probeResult = normalizePolicyDecision(policy.dynamicProbe({ vm }), "dynamic-code-blocked");
      if (!probeResult.allowed) {
        return {
          allowed: false,
          reason: "dynamic-code-blocked",
          detail: probeResult.detail,
          message: probeResult.message
        };
      }
      return { allowed: true, detail: probeResult.metrics ? { probeMetrics: probeResult.metrics } : null };
    }

    try {
      const probe = new Function("return 42;");
      if (probe() !== 42) {
        return {
          allowed: false,
          reason: "dynamic-code-blocked",
          detail: { error: { message: "function constructor returned unexpected value" } },
          message: "Managed JIT disabled: dynamic code generation returned unexpected results"
        };
      }
    } catch (error) {
      return {
        allowed: false,
        reason: "dynamic-code-blocked",
        detail: { error: sanitizeError(error) },
        message: "Managed JIT disabled: dynamic code generation is blocked"
      };
    }

    return { allowed: true };
  }

  function checkPerformanceAllowance() {
    if (policy.ignoreSlowMachine === true) {
      return { allowed: true };
    }
    const threshold = isFiniteNumber(policy.slowMachineThreshold) && policy.slowMachineThreshold > 0
      ? policy.slowMachineThreshold
      : DEFAULT_SLOW_MACHINE_THRESHOLD;
    const loadRate = computeObjectsPerMillisecond(vm);
    if (!isFiniteNumber(loadRate)) {
      return { allowed: true };
    }
    const metrics = {
      objectsPerMillisecond: loadRate,
      objectsPerSecond: loadRate * 1000,
      slowMachineThreshold: threshold
    };
    if (typeof policy.allowSlowMachine === "function") {
      const decision = normalizePolicyDecision(policy.allowSlowMachine({
        vm,
        rate: loadRate,
        threshold
      }), "slow-machine");
      if (!decision.allowed) {
        return {
          allowed: false,
          reason: "slow-machine",
          detail: decision.detail || { rate: loadRate, threshold },
          message: decision.message || "Managed JIT disabled: policy denied slow machine promotion",
          metrics
        };
      }
      if (decision.metrics) {
        metrics.policyMetrics = decision.metrics;
      }
      return { allowed: true, metrics };
    }
    if (loadRate < threshold) {
      return {
        allowed: false,
        reason: "slow-machine",
        detail: { rate: loadRate, threshold },
        message: "Managed JIT disabled: slow machine detected",
        metrics
      };
    }
    return { allowed: true, metrics };
  }

  function instantiateCompiler() {
    const squeak = getSqueakNamespace(vm);
    if (!squeak || !squeak.Compiler) {
      return {
        allowed: false,
        reason: "missing-compiler",
        message: "Squeak.Compiler not loaded, using interpreter only"
      };
    }
    try {
      const compiler = new squeak.Compiler(vm);
      if (!compiler || typeof compiler.compile !== "function") {
        return {
          allowed: false,
          reason: "jit-initialization-error",
          detail: { error: { message: "Compiler did not expose compile method" } },
          message: "Managed JIT disabled: compiler missing compile entrypoint"
        };
      }
      return {
        allowed: true,
        compiler
      };
    } catch (error) {
      return {
        allowed: false,
        reason: "jit-initialization-error",
        detail: { error: sanitizeError(error) },
        message: "Managed JIT disabled: compiler initialization failed"
      };
    }
  }

  function activateCompiler(compiler, metrics) {
    if (typeof policy.onActivated === "function") {
      try {
        policy.onActivated({ vm, compiler, metrics });
      } catch (_) {
        // ignore activation hook errors
      }
    }
    return finalizeSuccess(compiler, metrics, "squeak: managed JIT compiler initialized");
  }

  return {
    initialize() {
      const dynamicAllowance = checkDynamicCodeAllowance();
      if (!dynamicAllowance.allowed) {
        return finalizeFailure(dynamicAllowance.reason, dynamicAllowance.detail, dynamicAllowance.message);
      }

      const performanceAllowance = checkPerformanceAllowance();
      if (!performanceAllowance.allowed) {
        return finalizeFailure(
          performanceAllowance.reason,
          performanceAllowance.detail,
          performanceAllowance.message
        );
      }

      const instantiation = instantiateCompiler();
      if (!instantiation.allowed) {
        return finalizeFailure(instantiation.reason, instantiation.detail, instantiation.message);
      }

      return activateCompiler(instantiation.compiler, performanceAllowance.metrics || dynamicAllowance.detail || null);
    }
  };
}
