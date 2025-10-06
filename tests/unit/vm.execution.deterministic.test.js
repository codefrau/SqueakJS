import test from "node:test";
import assert from "node:assert/strict";

import { applyDeterministicMode } from "../../vm.execution.deterministic.js";

function computeLCGSequence(seed, count) {
  let state = (seed >>> 0) || 0;
  const values = [];
  for (let i = 0; i < count; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    values.push(state / 0x100000000);
  }
  return values;
}

test("applyDeterministicMode returns disabled environment when not requested", () => {
  const vm = {};
  const originalDateNow = Date.now;
  const result = applyDeterministicMode(vm, {});
  assert.equal(result.enabled, false);
  assert.equal(Date.now, originalDateNow);
});

test("deterministic mode overrides time, random, and network", () => {
  const originalDate = Date;
  const originalRandom = Math.random;
  const originalFetch = globalThis.fetch;

  const vm = {};
  const environment = applyDeterministicMode(vm, {
    deterministic: {
      clock: { start: 5000, step: 25 },
      random: { seed: 0xABCD1234 },
      network: { block: true }
    }
  });

  try {
    assert.equal(environment.enabled, true);
    assert.equal(Date.now(), 5000);
    assert.equal(Date.now(), 5025);

    const observed = [Math.random(), Math.random(), Math.random()];
    const expected = computeLCGSequence(0xABCD1234, 3);
    assert.deepEqual(observed, expected);

    if (typeof fetch === "function") {
      assert.throws(() => {
        fetch("https://example.com");
      }, (error) => error && error.code === "ERR_DETERMINISTIC_NETWORK");
    }

    assert.equal(environment.network.blocked, true);
  } finally {
    environment.restore();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete globalThis.fetch;
    }
    globalThis.Date = originalDate;
    Math.random = originalRandom;
  }

  assert.equal(globalThis.Date, originalDate);
  assert.equal(Math.random, originalRandom);
  if (typeof fetch === "function" && originalFetch) {
    assert.equal(globalThis.fetch, originalFetch);
  }
});

test("applyDeterministicMode reuses existing environment", () => {
  const vm = {};
  const originalDate = Date;
  const originalRandom = Math.random;
  const originalFetch = globalThis.fetch;
  const environment = applyDeterministicMode(vm, { deterministic: true });
  try {
    const reused = applyDeterministicMode(vm, { deterministic: true });
    assert.equal(reused, environment);
  } finally {
    environment.restore();
    globalThis.Date = originalDate;
    Math.random = originalRandom;
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete globalThis.fetch;
    }
  }
});
