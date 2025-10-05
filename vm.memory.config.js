"use strict";

const MB = 1000000;
const DEFAULT_HEADROOM_MB = 100;
const DEFAULT_LOW_SPACE_MB = 1;
const DEFAULT_YOUNG_RATIO = 0.2;
const MAX_YOUNG_RATIO = 0.5;

function firstDefined(values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value === value) {
            return value;
        }
    }
    return undefined;
}

function toPositiveNumber(value) {
    if (typeof value === "number") {
        return isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return isFinite(parsed) ? parsed : null;
    }
    return null;
}

function toBytesCandidate(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") {
        return isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(b|kb|k|mb|m|gb|g)?$/i);
        if (!match) return null;
        const numeric = Number(match[1]);
        if (!isFinite(numeric)) return null;
        const unit = (match[2] || "b").toLowerCase();
        let multiplier = 1;
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

function multiplyMB(value) {
    const number = toPositiveNumber(value);
    if (number === null) return null;
    return number * MB;
}

function clampBytes(value, fallback) {
    if (typeof value === "number" && isFinite(value) && value >= 0) {
        return Math.round(value);
    }
    return fallback;
}

function toRatioCandidate(value) {
    const number = toPositiveNumber(value);
    if (number === null) return null;
    return number;
}

function toRatioFromPercent(value) {
    const number = toPositiveNumber(value);
    if (number === null) return null;
    return number / 100;
}

function clampRatio(value) {
    if (typeof value !== "number" || !isFinite(value)) {
        return DEFAULT_YOUNG_RATIO;
    }
    if (value <= 0) return 0;
    if (value > MAX_YOUNG_RATIO) return MAX_YOUNG_RATIO;
    return value;
}

export function normalizeMemoryOptions(rawOptions) {
    const options = (rawOptions && typeof rawOptions === "object") ? rawOptions : {};

    const headroomCandidate = firstDefined([
        toBytesCandidate(options.headroomBytes),
        toBytesCandidate(options.headroom),
        multiplyMB(options.headroomMB),
        multiplyMB(options.headroomMiB),
    ]);
    const headroomBytes = clampBytes(
        headroomCandidate,
        DEFAULT_HEADROOM_MB * MB,
    );

    const lowSpaceCandidate = firstDefined([
        toBytesCandidate(options.gcThresholdBytes),
        toBytesCandidate(options.gcThreshold),
        toBytesCandidate(options.lowSpaceBytes),
        toBytesCandidate(options.lowSpace),
        multiplyMB(options.gcThresholdMB),
        multiplyMB(options.lowSpaceMB),
    ]);
    const lowSpaceBytes = clampBytes(
        lowSpaceCandidate,
        DEFAULT_LOW_SPACE_MB * MB,
    );

    const explicitYoungCandidate = firstDefined([
        toBytesCandidate(options.youngSpaceBytes),
        toBytesCandidate(options.youngBytes),
        toBytesCandidate(options.youngSpace),
        multiplyMB(options.youngSpaceMB),
        multiplyMB(options.youngMB),
    ]);
    const explicitYoungBytes = explicitYoungCandidate === undefined
        ? null
        : clampBytes(explicitYoungCandidate, null);
    const explicitYoung = explicitYoungBytes === null ? null : explicitYoungBytes;

    const ratioCandidate = firstDefined([
        toRatioCandidate(options.youngSpaceRatio),
        toRatioCandidate(options.youngRatio),
        toRatioFromPercent(options.youngPercent),
        toRatioFromPercent(options.youngSpacePercent),
    ]);
    const youngSpaceRatio = clampRatio(
        ratioCandidate === undefined ? DEFAULT_YOUNG_RATIO : ratioCandidate,
    );

    return {
        headroomBytes,
        lowSpaceBytes,
        youngSpaceRatio,
        explicitYoungBytes: explicitYoung,
    };
}

export function deriveYoungSpaceLimit(totalMemory, policy) {
    if (!policy || typeof totalMemory !== "number" || !isFinite(totalMemory) || totalMemory <= 0) {
        return 0;
    }
    if (typeof policy.explicitYoungBytes === "number" && isFinite(policy.explicitYoungBytes) && policy.explicitYoungBytes >= 0) {
        const limit = Math.round(policy.explicitYoungBytes);
        return limit > totalMemory ? Math.round(totalMemory) : limit;
    }
    const ratio = typeof policy.youngSpaceRatio === "number" ? policy.youngSpaceRatio : DEFAULT_YOUNG_RATIO;
    if (ratio <= 0) return 0;
    return Math.round(totalMemory * ratio);
}

export const DEFAULT_HEADROOM_BYTES = DEFAULT_HEADROOM_MB * MB;
export const DEFAULT_LOW_SPACE_BYTES = DEFAULT_LOW_SPACE_MB * MB;
export const DEFAULT_YOUNG_SPACE_RATIO = DEFAULT_YOUNG_RATIO;
export const MAX_YOUNG_SPACE_RATIO = MAX_YOUNG_RATIO;
