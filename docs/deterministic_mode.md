# Deterministic Execution Mode

Deterministic mode provides a reproducible execution profile for SqueakJS by replacing
runtime sources of nondeterminism with predictable shims. The mode is driven by the
refactoring program's security backlog and is primarily intended for regression tracking
and hardened deployments.

## Enabling deterministic execution

Deterministic mode is activated through the interpreter options passed to
`new Squeak.Interpreter(image, display, options)`. Set the `deterministic` option to
`true` for defaults, or supply an object for fine-grained control:

```js
const vm = new Squeak.Interpreter(image, display, {
  deterministic: {
    clock: { start: 0, step: 5 },
    random: { seed: 0x12345678 },
    network: { block: true }
  }
});
```

The configuration accepts the following fields:

- `clock.start`: Initial millisecond timestamp reported by `Date.now()` and `new Date()`.
- `clock.step`: Milliseconds advanced on each clock read (defaults to `1`).
- `random.seed`: Seed for the deterministic pseudo-random generator used to replace
  `Math.random()`.
- `network.block`: When `true` (default) the VM throws `ERR_DETERMINISTIC_NETWORK` if
  `fetch` or `XMLHttpRequest` are invoked, preventing network-dependent fallbacks.
- `network.allowNetwork`: Set to `true` to keep network APIs enabled while maintaining
  deterministic clocks and randomness.

## Runtime behavior

When deterministic mode is active:

- `Date.now()`, `new Date()`, and `performance.now()` advance using the configured clock
  step instead of wall-clock time.
- `Math.random()` produces values from a deterministic linear-congruential generator
  seeded via the configuration, guaranteeing repeatable sequences.
- `fetch` and `XMLHttpRequest` throw an `ERR_DETERMINISTIC_NETWORK` error unless
  explicitly allowed, preventing external variability from influencing execution.
- Capability negotiation records the deterministic configuration so tooling and
  telemetry consumers can identify deterministic runs.

A reference to the deterministic environment is stored on the interpreter instance at
`vm.deterministicEnvironment`. Hosts can call `vm.deterministicEnvironment.restore()` to
restore original globals (useful for unit tests that need to clean up after forcing
determinism).

## Validation

The deterministic runtime is enforced by `tests/unit/vm.execution.deterministic.test.js`,
which covers clock, randomness, and network overrides. The `npm test` command also runs
`tools/lint-dynamic-code.js`, ensuring that any new dynamic-code sites remain guarded by
the deterministic policy framework.
