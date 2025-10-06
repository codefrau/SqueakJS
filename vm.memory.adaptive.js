"use strict";

const MB = 1000000;
const DEFAULT_INTERVAL_MS = 2500;
const DEFAULT_GROW_FREE_RATIO = 0.15;
const DEFAULT_SHRINK_FREE_RATIO = 0.65;
const DEFAULT_GROW_STEP_MB = 8;
const DEFAULT_SHRINK_STEP_MB = 6;
const DEFAULT_MIN_FREE_MB = 2;
const DEFAULT_MAX_HEADROOM_MULTIPLIER = 4;
const DEFAULT_HOST_GROW_CEILING = 0.82;
const DEFAULT_HOST_PRESSURE_RATIO = 0.88;
const DEFAULT_HOST_CRITICAL_RATIO = 0.94;
const DEFAULT_HOST_USAGE_CAP_RATIO = 0.9;
const DEFAULT_HOST_RESERVE_RATIO = 0.08;
const DEFAULT_GC_THROTTLE_MS = 4000;
const DEFAULT_HEADROOM_EPSILON_BYTES = 512000;

function firstDefined(values) {
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (value !== undefined && value !== null && value === value) {
            return value;
        }
    }
    return undefined;
}

function toFiniteNumber(value) {
    if (typeof value === "number") return isFinite(value) ? value : NaN;
    if (typeof value === "string" && value.trim()) {
        var parsed = Number(value);
        return isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
}

function nonNegative(value, fallback) {
    var parsed = toFiniteNumber(value);
    if (!isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
}

function clampRatio(value, fallback, min, max) {
    var parsed = toFiniteNumber(value);
    if (!isFinite(parsed)) parsed = fallback;
    var lower = (typeof min === "number" && isFinite(min)) ? min : 0;
    var upper = (typeof max === "number" && isFinite(max)) ? max : 1;
    if (parsed < lower) parsed = lower;
    if (parsed > upper) parsed = upper;
    return parsed;
}

function toBytesCandidate(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") {
        return isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        var trimmed = value.trim();
        if (!trimmed) return null;
        var match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(b|kb|k|mb|m|gb|g)?$/i);
        if (!match) return null;
        var numeric = Number(match[1]);
        if (!isFinite(numeric)) return null;
        var unit = (match[2] || "b").toLowerCase();
        var multiplier = 1;
        switch (unit) {
            case "kb":
            case "k":
                multiplier = 1000;
                break;
            case "mb":
            case "m":
                multiplier = MB;
                break;
            case "gb":
            case "g":
                multiplier = MB * 1000;
                break;
            default:
                multiplier = 1;
        }
        return numeric * multiplier;
    }
    return null;
}

function clampBytes(value, fallback, minimum) {
    if (typeof value === "number" && isFinite(value) && value >= 0) {
        var rounded = Math.round(value);
        if (typeof minimum === "number" && isFinite(minimum) && rounded < minimum) {
            return minimum;
        }
        return rounded;
    }
    return fallback;
}

function keyMultiplier(key) {
    var lower = String(key || "").toLowerCase();
    if (lower.endsWith("mib") || lower.endsWith("mb")) return MB;
    if (lower.endsWith("gib") || lower.endsWith("gb")) return MB * 1000;
    if (lower.endsWith("kb") || lower.endsWith("kib")) return 1000;
    return 1;
}

function parseBytesOption(source, keys) {
    if (!source || typeof source !== "object") return undefined;
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var raw = source[key];
        if (raw === undefined || raw === null) continue;
        var candidate = toBytesCandidate(raw);
        if (candidate !== null && candidate !== undefined) {
            var multiplier = keyMultiplier(key);
            if (multiplier !== 1) {
                var rawString = typeof raw === "string" ? raw.trim() : "";
                var hasExplicitUnit = typeof rawString === "string" && /[a-z]/i.test(rawString);
                if (!hasExplicitUnit) {
                    candidate *= multiplier;
                }
            }
            return candidate;
        }
    }
    return undefined;
}

function extractAdaptiveOptions(options) {
    if (!options || typeof options !== "object") return undefined;
    var candidates = [];
    if (options.memoryAdaptive !== undefined) candidates.push(options.memoryAdaptive);
    if (options.adaptiveMemory !== undefined) candidates.push(options.adaptiveMemory);
    if (options.memory && typeof options.memory === "object" && options.memory.adaptive !== undefined) {
        candidates.push(options.memory.adaptive);
    }
    if (options.memory && typeof options.memory === "object" && options.memory.adaptiveStrategy !== undefined) {
        candidates.push(options.memory.adaptiveStrategy);
    }
    if (options.memoryStrategy !== undefined) candidates.push(options.memoryStrategy);
    if (options.vm && typeof options.vm === "object") {
        var vmOptions = options.vm;
        if (vmOptions.memoryAdaptive !== undefined) candidates.push(vmOptions.memoryAdaptive);
        if (vmOptions.adaptiveMemory !== undefined) candidates.push(vmOptions.adaptiveMemory);
        if (vmOptions.memory && typeof vmOptions.memory === "object" && vmOptions.memory.adaptive !== undefined) {
            candidates.push(vmOptions.memory.adaptive);
        }
        if (vmOptions.memory && typeof vmOptions.memory === "object" && vmOptions.memory.adaptiveStrategy !== undefined) {
            candidates.push(vmOptions.memory.adaptiveStrategy);
        }
    }
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] !== undefined) return candidates[i];
    }
    return undefined;
}

function normalizeAdaptiveConfig(options) {
    var raw = extractAdaptiveOptions(options);
    if (raw === false) {
        return { enabled: false };
    }
    var source = raw;
    if (source === undefined || source === true) {
        source = {};
    } else if (typeof source === "number") {
        source = { intervalMs: source };
    } else if (typeof source === "string" && source.trim()) {
        var parsed = Number(source);
        source = isFinite(parsed) ? { intervalMs: parsed } : {};
    } else if (!source || typeof source !== "object") {
        source = {};
    }

    var intervalMs = nonNegative(source.intervalMs, DEFAULT_INTERVAL_MS);
    var growFreeRatio = clampRatio(
        firstDefined([source.growFreeRatio, source.expandFreeRatio, source.growWhenFreeBelow]),
        DEFAULT_GROW_FREE_RATIO,
        0.01,
        0.5
    );
    var shrinkFreeRatio = clampRatio(
        firstDefined([source.shrinkFreeRatio, source.releaseFreeRatio, source.shrinkWhenFreeAbove]),
        DEFAULT_SHRINK_FREE_RATIO,
        0.2,
        0.95
    );
    if (shrinkFreeRatio < growFreeRatio + 0.05) {
        shrinkFreeRatio = growFreeRatio + 0.05;
        if (shrinkFreeRatio > 0.95) shrinkFreeRatio = 0.95;
    }

    var growStepCandidate = parseBytesOption(source, [
        "growStepBytes",
        "growStep",
        "expandStepBytes",
        "expandStep",
        "growStepMB",
        "expandStepMB"
    ]);
    var shrinkStepCandidate = parseBytesOption(source, [
        "shrinkStepBytes",
        "shrinkStep",
        "releaseStepBytes",
        "releaseStep",
        "shrinkStepMB",
        "releaseStepMB"
    ]);
    var minHeadroomCandidate = parseBytesOption(source, [
        "minHeadroomBytes",
        "minHeadroom",
        "minimumHeadroomBytes",
        "minimumHeadroom",
        "minHeadroomMB",
        "minimumHeadroomMB"
    ]);
    var maxHeadroomCandidate = parseBytesOption(source, [
        "maxHeadroomBytes",
        "maxHeadroom",
        "maximumHeadroomBytes",
        "maximumHeadroom",
        "maxHeadroomMB",
        "maximumHeadroomMB"
    ]);
    var minimumFreeCandidate = parseBytesOption(source, [
        "minimumFreeBytes",
        "minimumFree",
        "minFreeBytes",
        "minFree",
        "minimumFreeMB",
        "minFreeMB"
    ]);
    var reserveCandidate = parseBytesOption(source, [
        "hostReserveBytes",
        "reserveBytes",
        "hostReserve",
        "reserveMB",
        "hostReserveMB"
    ]);
    var headroomEpsilonCandidate = parseBytesOption(source, [
        "headroomEpsilonBytes",
        "headroomEpsilon",
        "headroomEpsilonMB"
    ]);

    var hostGrowCeiling = clampRatio(source.hostGrowCeiling, DEFAULT_HOST_GROW_CEILING, 0.1, 0.95);
    var hostPressureRatio = clampRatio(source.hostPressureRatio, DEFAULT_HOST_PRESSURE_RATIO, hostGrowCeiling, 0.99);
    var hostCriticalRatio = clampRatio(source.hostCriticalRatio, DEFAULT_HOST_CRITICAL_RATIO, hostPressureRatio, 0.999);
    if (hostCriticalRatio < hostPressureRatio) hostCriticalRatio = hostPressureRatio;
    var hostUsageCapRatio = clampRatio(source.hostUsageCapRatio, DEFAULT_HOST_USAGE_CAP_RATIO, 0.2, 0.98);
    var hostReserveRatio = clampRatio(source.hostReserveRatio, DEFAULT_HOST_RESERVE_RATIO, 0, 0.5);

    var growStepBytes = clampBytes(
        growStepCandidate,
        Math.round(DEFAULT_GROW_STEP_MB * MB),
        Math.round(1 * MB)
    );
    var shrinkStepBytes = clampBytes(
        shrinkStepCandidate,
        Math.round(DEFAULT_SHRINK_STEP_MB * MB),
        Math.round(1 * MB)
    );
    var minHeadroomBytes = clampBytes(
        minHeadroomCandidate,
        NaN,
        0
    );
    var maxHeadroomBytes = clampBytes(
        maxHeadroomCandidate,
        NaN,
        0
    );
    var minimumFreeBytes = clampBytes(
        minimumFreeCandidate,
        Math.round(DEFAULT_MIN_FREE_MB * MB),
        Math.round(512 * 1000)
    );
    var hostReserveBytes = clampBytes(
        reserveCandidate,
        0,
        0
    );
    var headroomEpsilonBytes = clampBytes(
        headroomEpsilonCandidate,
        DEFAULT_HEADROOM_EPSILON_BYTES,
        0
    );
    var gcThrottleMs = nonNegative(source.gcThrottleMs, DEFAULT_GC_THROTTLE_MS);

    return {
        enabled: true,
        intervalMs: intervalMs,
        growFreeRatio: growFreeRatio,
        shrinkFreeRatio: shrinkFreeRatio,
        growStepBytes: growStepBytes,
        shrinkStepBytes: shrinkStepBytes,
        minHeadroomBytes: isNaN(minHeadroomBytes) ? null : minHeadroomBytes,
        maxHeadroomBytes: isNaN(maxHeadroomBytes) ? null : maxHeadroomBytes,
        minimumFreeBytes: minimumFreeBytes,
        hostGrowCeiling: hostGrowCeiling,
        hostPressureRatio: hostPressureRatio,
        hostCriticalRatio: hostCriticalRatio,
        hostUsageCapRatio: hostUsageCapRatio,
        hostReserveRatio: hostReserveRatio,
        hostReserveBytes: hostReserveBytes,
        headroomEpsilonBytes: headroomEpsilonBytes,
        gcThrottleMs: gcThrottleMs,
    };
}

function toFinite(value, fallback) {
    var parsed = toFiniteNumber(value);
    if (!isFinite(parsed)) return fallback;
    return parsed;
}

function computeHostCap(state, snapshot) {
    var host = snapshot.host || {};
    var limit = toFinite(host.jsHeapSizeLimit, NaN);
    if (!isFinite(limit) || limit <= 0) return state.maxConfiguredHeadroomBytes;
    var reserve = Math.max(state.hostReserveBytes, Math.round(limit * state.hostReserveRatio));
    if (reserve < 0) reserve = 0;
    var usable = limit * state.hostUsageCapRatio;
    if (usable > limit - reserve) usable = limit - reserve;
    if (usable < 0) usable = 0;
    var oldSpace = toFinite(snapshot.oldSpaceBytes, 0);
    if (oldSpace < 0) oldSpace = 0;
    var cap = Math.round(usable - oldSpace);
    if (!isFinite(cap)) cap = state.maxConfiguredHeadroomBytes;
    if (cap < state.minHeadroomBytes) cap = state.minHeadroomBytes;
    return Math.max(state.minHeadroomBytes, Math.min(state.maxConfiguredHeadroomBytes, cap));
}

function ensureHeadroomBounds(state, target, snapshot) {
    var headroom = target;
    if (!isFinite(headroom) || headroom < state.minHeadroomBytes) {
        headroom = state.minHeadroomBytes;
    }
    var maxHeadroom = computeHostCap(state, snapshot);
    if (headroom > maxHeadroom) {
        headroom = maxHeadroom;
    }
    if (headroom < state.minHeadroomBytes) headroom = state.minHeadroomBytes;
    return headroom;
}

function getHeadroomFromSnapshot(state, snapshot) {
    var policy = snapshot.policy || {};
    var headroom = toFinite(policy.headroomBytes, NaN);
    if (!isFinite(headroom) || headroom <= 0) {
        headroom = toFinite(state.image.headRoom, 0);
    }
    return headroom > 0 ? headroom : 0;
}

function getHostRatio(snapshot) {
    var host = snapshot.host || {};
    var limit = toFinite(host.jsHeapSizeLimit, NaN);
    var used = toFinite(host.usedJSHeapSize, NaN);
    if (!isFinite(limit) || limit <= 0 || !isFinite(used) || used < 0) return null;
    var ratio = used / limit;
    if (!isFinite(ratio)) return null;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    return ratio;
}

function maybeTriggerGC(state, reason) {
    if (!state || typeof state.canTriggerGC !== "function" || !state.canTriggerGC()) return false;
    if (!state.gcController || typeof state.gcController.trigger !== "function") return false;
    state.lastGCTime = Date.now();
    try {
        return state.gcController.trigger(reason || "adaptive") !== false;
    } catch (e) {
        return false;
    }
}

function createHeadroomController(image) {
    if (!image || typeof image !== "object") {
        return {
            strategy: "none",
            apply: function() { return false; },
        };
    }
    if (typeof image._applyHeadroomAdjustment === "function") {
        return {
            strategy: "image-hook",
            apply: function(bytes) {
                if (typeof bytes !== "number" || !isFinite(bytes)) return false;
                try {
                    return image._applyHeadroomAdjustment(bytes) !== false;
                } catch (_) {
                    return false;
                }
            },
        };
    }
    return {
        strategy: "policy-fallback",
        apply: function(bytes) {
            if (typeof bytes !== "number" || !isFinite(bytes)) return false;
            var target = Math.round(bytes);
            if (target < 0) target = 0;
            if (typeof image.headRoom === "number" && image.headRoom === target) return false;
            image.headRoom = target;
            if (!image.memoryPolicy || typeof image.memoryPolicy !== "object") {
                image.memoryPolicy = { headroomBytes: target };
            } else {
                image.memoryPolicy.headroomBytes = target;
            }
            if (typeof image.oldSpaceBytes === "number" && isFinite(image.oldSpaceBytes)) {
                image.totalMemory = image.oldSpaceBytes + target;
            }
            if (typeof image._finalizeMemoryPolicyAfterLoad === "function") {
                try { image._finalizeMemoryPolicyAfterLoad(); } catch (_) {}
            }
            if (typeof image._syncLowSpaceMonitor === "function") {
                try { image._syncLowSpaceMonitor(); } catch (_) {}
            }
            return true;
        },
    };
}

function createGCController(vm, image) {
    if (!image || typeof image !== "object") {
        return {
            strategy: "none",
            trigger: function() { return false; },
        };
    }
    if (typeof image._triggerPartialGC === "function") {
        return {
            strategy: "partial-hook",
            trigger: function(reason) {
                try {
                    return image._triggerPartialGC(reason) !== false;
                } catch (_) {
                    return false;
                }
            },
        };
    }
    if (typeof image.partialGC === "function") {
        return {
            strategy: "partial-direct",
            trigger: function(reason) {
                try {
                    image.partialGC(reason || "adaptive");
                    return true;
                } catch (_) {
                    return false;
                }
            },
        };
    }
    if (typeof image.fullGC === "function") {
        return {
            strategy: "full-image",
            trigger: function(reason) {
                try {
                    image.fullGC(reason || "adaptive");
                    return true;
                } catch (_) {
                    return false;
                }
            },
        };
    }
    if (vm && typeof vm.fullGC === "function") {
        return {
            strategy: "full-vm",
            trigger: function(reason) {
                try {
                    vm.fullGC(reason || "adaptive");
                    return true;
                } catch (_) {
                    return false;
                }
            },
        };
    }
    return {
        strategy: "none",
        trigger: function() { return false; },
    };
}

function evaluateAdaptiveState(state, reason) {
    if (!state || !state.image || typeof state.image.captureMemorySnapshot !== "function") {
        return null;
    }
    var snapshot = state.image.captureMemorySnapshot(reason || "adaptive");
    if (!snapshot) return null;
    var attempts = 0;
    var decision = null;
    var triggeredAnyGC = false;
    while (attempts < 2) {
        attempts += 1;
        var headroom = getHeadroomFromSnapshot(state, snapshot);
        if (headroom <= 0) {
            decision = {
                timestamp: Date.now(),
                action: "maintain",
                reason: "no-headroom",
                headroomBefore: headroom,
                headroomAfter: headroom,
                freeRatio: 1,
                hostRatio: getHostRatio(snapshot),
                gcTriggered: false,
            };
            break;
        }
        var freeBytes = toFinite(snapshot.freeBytes, 0);
        if (freeBytes < 0) freeBytes = 0;
        var youngAllocated = toFinite(snapshot.youngAllocatedBytes, 0);
        if (youngAllocated < 0) youngAllocated = 0;
        var freeRatio = headroom > 0 ? Math.max(0, Math.min(1, freeBytes / headroom)) : 1;
        var hostRatio = getHostRatio(snapshot);
        var maxHeadroom = computeHostCap(state, snapshot);
        var desired = headroom;
        var action = "maintain";
        var actionReason = "stable";
        var gcTriggered = false;
        var overCap = headroom > maxHeadroom + state.headroomEpsilonBytes;
        var hostUnderPressure = hostRatio !== null && hostRatio >= state.hostPressureRatio;
        var hostCritical = hostRatio !== null && hostRatio >= state.hostCriticalRatio;
        if (hostCritical) {
            var criticalTriggered = maybeTriggerGC(state, "adaptive-critical");
            if (criticalTriggered) triggeredAnyGC = true;
            gcTriggered = criticalTriggered || gcTriggered;
        }
        if (hostUnderPressure) {
            desired = headroom - state.shrinkStepBytes;
            action = "shrink";
            actionReason = "host-pressure";
        } else if (overCap) {
            desired = Math.min(headroom, maxHeadroom);
            action = "shrink";
            actionReason = "host-cap";
        } else if (headroom < maxHeadroom && freeRatio <= state.growFreeRatio && (hostRatio === null || hostRatio < state.hostGrowCeiling)) {
            desired = headroom + state.growStepBytes;
            action = "grow";
            actionReason = "free-low";
        } else if (hostRatio !== null && hostRatio >= state.hostGrowCeiling && freeRatio >= state.shrinkFreeRatio && headroom > state.minHeadroomBytes + state.headroomEpsilonBytes) {
            desired = headroom - state.shrinkStepBytes;
            action = "shrink";
            actionReason = "free-surplus";
        }

        desired = ensureHeadroomBounds(state, desired, snapshot);
        var minimumRequired = Math.max(state.minHeadroomBytes, youngAllocated + state.minimumFreeBytes);
        if (desired < minimumRequired - state.headroomEpsilonBytes) {
            if (maybeTriggerGC(state, "adaptive-pre-shrink")) {
                triggeredAnyGC = true;
                gcTriggered = true;
                snapshot = state.image.captureMemorySnapshot("adaptive-post-gc");
                if (!snapshot) break;
                continue;
            }
            desired = minimumRequired;
        }
        desired = ensureHeadroomBounds(state, desired, snapshot);
        if (Math.abs(desired - headroom) <= state.headroomEpsilonBytes) {
            desired = headroom;
            action = "maintain";
            actionReason = "stable";
        }
        if (desired !== headroom && typeof state.applyHeadroom === "function") {
            state.applyHeadroom(desired);
        }
        decision = {
            timestamp: Date.now(),
            action: action,
            reason: actionReason,
            headroomBefore: headroom,
            headroomAfter: desired,
            freeRatio: freeRatio,
            hostRatio: hostRatio,
            gcTriggered: triggeredAnyGC || gcTriggered,
        };
        break;
    }
    state.lastDecision = decision;
    return decision;
}

export function startAdaptiveMemoryManager(vm, options) {
    if (!vm || !vm.image) return null;
    var config = normalizeAdaptiveConfig(options || vm.options || {});
    if (!config.enabled) {
        var disabledState = vm.image.memoryAdaptive || { enabled: false, stop: function() {} };
        disabledState.enabled = false;
        vm.image.memoryAdaptive = disabledState;
        vm.memoryAdaptive = disabledState;
        return disabledState;
    }
    var image = vm.image;
    if (image.memoryAdaptive && typeof image.memoryAdaptive.stop === "function") {
        image.memoryAdaptive.stop();
    }
    var baseline = toFinite(image.memoryPolicy && image.memoryPolicy.headroomBytes, toFinite(image.headRoom, 0));
    if (!isFinite(baseline) || baseline <= 0) baseline = DEFAULT_GROW_STEP_MB * MB;
    var minHeadroom = config.minHeadroomBytes;
    if (!isFinite(minHeadroom) || minHeadroom === null) {
        minHeadroom = Math.round(baseline * 0.5);
    }
    if (minHeadroom < Math.round(1 * MB)) minHeadroom = Math.round(1 * MB);
    var maxHeadroom = config.maxHeadroomBytes;
    if (!isFinite(maxHeadroom) || maxHeadroom === null || maxHeadroom < minHeadroom) {
        maxHeadroom = Math.max(minHeadroom, Math.round(baseline * DEFAULT_MAX_HEADROOM_MULTIPLIER));
    }

    var headroomController = createHeadroomController(image);
    var gcController = createGCController(vm, image);

    var state = {
        enabled: true,
        vm: vm,
        image: image,
        config: config,
        minHeadroomBytes: minHeadroom,
        maxConfiguredHeadroomBytes: maxHeadroom,
        hostGrowCeiling: config.hostGrowCeiling,
        hostPressureRatio: config.hostPressureRatio,
        hostCriticalRatio: config.hostCriticalRatio,
        hostUsageCapRatio: config.hostUsageCapRatio,
        hostReserveRatio: config.hostReserveRatio,
        hostReserveBytes: config.hostReserveBytes,
        growFreeRatio: config.growFreeRatio,
        shrinkFreeRatio: config.shrinkFreeRatio,
        growStepBytes: config.growStepBytes,
        shrinkStepBytes: config.shrinkStepBytes,
        minimumFreeBytes: config.minimumFreeBytes,
        headroomEpsilonBytes: config.headroomEpsilonBytes,
        gcThrottleMs: config.gcThrottleMs,
        lastGCTime: 0,
        timer: null,
        lastDecision: null,
        applyHeadroom: function(bytes) {
            return headroomController.apply(bytes);
        },
        gcController: gcController,
        canTriggerGC: function() {
            if (!this.gcController || this.gcController.strategy === "none") return false;
            if (!this.gcThrottleMs) return true;
            return (Date.now() - this.lastGCTime) >= this.gcThrottleMs;
        },
        poke: function(reason) {
            return evaluateAdaptiveState(this, reason || "manual");
        },
        stop: function() {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            this.enabled = false;
        },
    };

    state.maxHeadroomBytes = state.maxConfiguredHeadroomBytes;
    state.guardrails = {
        headroomStrategy: headroomController.strategy,
        gcStrategy: gcController.strategy,
    };
    state.guardrailsActive = headroomController.strategy !== "image-hook" || (gcController.strategy !== "partial-hook");

    if (config.intervalMs > 0) {
        state.timer = setInterval(function() {
            evaluateAdaptiveState(state, "interval");
        }, config.intervalMs);
    }

    evaluateAdaptiveState(state, "initial");

    image.memoryAdaptive = state;
    vm.memoryAdaptive = state;
    return state;
}

export { normalizeAdaptiveConfig };
