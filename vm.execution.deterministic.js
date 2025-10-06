"use strict";

const DEFAULT_CLOCK_START = 0;
const DEFAULT_CLOCK_STEP = 1;
const DEFAULT_RANDOM_SEED = 0x12345678;

function toFiniteNumber(value, fallback) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeDeterministicConfig(options) {
  if (!options || typeof options !== "object") {
    return { enabled: false };
  }

  const raw = options.deterministic ?? options.deterministicMode ?? options.execution?.deterministic;
  if (raw === false || raw === null) {
    return { enabled: false };
  }

  if (raw === undefined) {
    return { enabled: false };
  }

  if (raw === true) {
    return {
      enabled: true,
      clock: { start: DEFAULT_CLOCK_START, step: DEFAULT_CLOCK_STEP },
      random: { seed: DEFAULT_RANDOM_SEED },
      network: { block: true }
    };
  }

  let source = raw;
  if (typeof raw === "number" || typeof raw === "string") {
    const numeric = toFiniteNumber(raw, null);
    source = Number.isFinite(numeric) ? { clock: { step: Math.max(1, Math.floor(numeric)) } } : {};
  } else if (typeof raw !== "object") {
    source = {};
  }

  const clock = typeof source.clock === "object" && source.clock !== null ? source.clock : source;
  const clockStart = toFiniteNumber(clock.start, DEFAULT_CLOCK_START);
  const clockStep = Math.max(1, Math.floor(toFiniteNumber(clock.step, DEFAULT_CLOCK_STEP)));

  const random = typeof source.random === "object" && source.random !== null ? source.random : {};
  const seedCandidate = random.seed ?? source.seed;
  const randomSeed = toFiniteNumber(seedCandidate, DEFAULT_RANDOM_SEED);

  const networkSource = typeof source.network === "object" && source.network !== null ? source.network : source;
  const blockNetwork = networkSource.blockNetwork ?? networkSource.block ?? (networkSource.allowNetwork === undefined);
  const allowNetwork = networkSource.allowNetwork === true;

  return {
    enabled: true,
    clock: {
      start: Number.isFinite(clockStart) ? clockStart : DEFAULT_CLOCK_START,
      step: Number.isFinite(clockStep) && clockStep > 0 ? clockStep : DEFAULT_CLOCK_STEP
    },
    random: {
      seed: Number.isFinite(randomSeed) ? randomSeed : DEFAULT_RANDOM_SEED
    },
    network: {
      block: allowNetwork ? false : blockNetwork !== false
    }
  };
}

function createDeterministicRandom(seed) {
  let state = (seed >>> 0) || 0;
  return function deterministicRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createDeterministicClock(start, step) {
  let current = start;
  return function deterministicNow() {
    const value = current;
    current += step;
    return value;
  };
}

function overrideDateConstructor(clock) {
  const OriginalDate = globalThis.Date;
  if (typeof OriginalDate !== "function") {
    return () => {};
  }

  function DeterministicDate(...args) {
    if (!(this instanceof DeterministicDate)) {
      return new OriginalDate(...args);
    }
    if (args.length === 0) {
      return new OriginalDate(clock());
    }
    return new OriginalDate(...args);
  }

  DeterministicDate.prototype = OriginalDate.prototype;
  DeterministicDate.prototype.constructor = DeterministicDate;
  if (typeof Object.setPrototypeOf === "function") {
    Object.setPrototypeOf(DeterministicDate, OriginalDate);
  } else {
    DeterministicDate.__proto__ = OriginalDate; // eslint-disable-line no-proto
  }
  DeterministicDate.UTC = OriginalDate.UTC.bind(OriginalDate);
  DeterministicDate.parse = OriginalDate.parse.bind(OriginalDate);
  DeterministicDate.now = () => clock();

  const descriptors = Object.getOwnPropertyNames(OriginalDate)
    .filter((key) => !["length", "name", "prototype", "UTC", "parse", "now"].includes(key));
  for (const key of descriptors) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(OriginalDate, key);
      if (descriptor) {
        Object.defineProperty(DeterministicDate, key, descriptor);
      }
    } catch (_) {
      // ignore descriptor copy failures
    }
  }

  globalThis.Date = DeterministicDate;
  return () => {
    if (globalThis.Date === DeterministicDate) {
      globalThis.Date = OriginalDate;
    }
  };
}

function overrideMathRandom(random) {
  if (typeof Math !== "object" || typeof Math.random !== "function") {
    return () => {};
  }
  const original = Math.random;
  Math.random = random;
  return () => {
    if (Math.random === random) {
      Math.random = original;
    }
  };
}

function overridePerformanceNow(nowFn, startValue) {
  if (typeof globalThis.performance !== "object" || typeof globalThis.performance.now !== "function") {
    return () => {};
  }
  const original = globalThis.performance.now.bind(globalThis.performance);
  globalThis.performance.now = () => nowFn() - startValue;
  return () => {
    if (globalThis.performance.now && globalThis.performance.now !== original) {
      globalThis.performance.now = original;
    }
  };
}

function overrideFetch(blockedMessage) {
  if (typeof globalThis.fetch !== "function") {
    return () => {};
  }
  const original = globalThis.fetch;
  function blockedFetch() {
    const error = new Error(blockedMessage);
    error.code = "ERR_DETERMINISTIC_NETWORK";
    throw error;
  }
  globalThis.fetch = blockedFetch;
  return () => {
    if (globalThis.fetch === blockedFetch) {
      globalThis.fetch = original;
    }
  };
}

function overrideXMLHttpRequest(blockedMessage) {
  const OriginalXHR = globalThis.XMLHttpRequest;
  if (typeof OriginalXHR !== "function") {
    return () => {};
  }
  function BlockedXMLHttpRequest() {
    const error = new Error(blockedMessage);
    error.code = "ERR_DETERMINISTIC_NETWORK";
    throw error;
  }
  BlockedXMLHttpRequest.prototype = OriginalXHR ? OriginalXHR.prototype : undefined;
  globalThis.XMLHttpRequest = BlockedXMLHttpRequest;
  return () => {
    if (globalThis.XMLHttpRequest === BlockedXMLHttpRequest) {
      globalThis.XMLHttpRequest = OriginalXHR;
    }
  };
}

function applyDeterministicEnvironment(config) {
  const clock = createDeterministicClock(config.clock.start, config.clock.step);
  const random = createDeterministicRandom(config.random.seed);

  const restoreCallbacks = [];

  restoreCallbacks.push(overrideDateConstructor(clock));

  restoreCallbacks.push(overrideMathRandom(random));

  restoreCallbacks.push(overridePerformanceNow(clock, config.clock.start));

  let networkOverrides = [];
  if (config.network.block) {
    const message = "Deterministic mode prohibits network access";
    networkOverrides.push(overrideFetch(message));
    networkOverrides.push(overrideXMLHttpRequest(message));
  }

  const restore = () => {
    for (let i = networkOverrides.length - 1; i >= 0; i -= 1) {
      networkOverrides[i]();
    }
    for (let i = restoreCallbacks.length - 1; i >= 0; i -= 1) {
      restoreCallbacks[i]();
    }
  };

  return {
    enabled: true,
    clock: {
      start: config.clock.start,
      step: config.clock.step,
      now: clock
    },
    random: {
      seed: config.random.seed,
      next: random
    },
    network: {
      blocked: config.network.block
    },
    restore
  };
}

export function applyDeterministicMode(vm, options) {
  if (!vm || typeof vm !== "object") {
    throw new Error("applyDeterministicMode requires a vm instance");
  }

  const config = normalizeDeterministicConfig(options);
  if (!config.enabled) {
    vm.deterministicEnvironment = { enabled: false };
    return vm.deterministicEnvironment;
  }

  if (vm.deterministicEnvironment && vm.deterministicEnvironment.enabled) {
    return vm.deterministicEnvironment;
  }

  const environment = applyDeterministicEnvironment(config);
  vm.deterministicEnvironment = environment;
  return environment;
}

export function isDeterministicModeEnabled(vm) {
  return !!(vm && vm.deterministicEnvironment && vm.deterministicEnvironment.enabled);
}

export function getDeterministicSummary(vm) {
  if (!isDeterministicModeEnabled(vm)) {
    return null;
  }
  const env = vm.deterministicEnvironment;
  return {
    clock: { start: env.clock.start, step: env.clock.step },
    random: { seed: env.random.seed },
    network: { blocked: env.network.blocked }
  };
}

if (import.meta.url === (typeof document === "object" && document.currentScript
  ? document.currentScript.src
  : undefined)) {
  applyDeterministicMode(globalThis, {});
}
