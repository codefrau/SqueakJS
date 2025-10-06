import test from "node:test";
import assert from "node:assert/strict";

import {
  createManagedJITController,
  MANAGED_JIT_TELEMETRY_NAMESPACE
} from "../../vm.execution.jit.manager.js";
import {
  getTelemetryChannelState,
  resetTelemetryChannels
} from "../../vm.telemetry.channel.js";

test("managed JIT controller enables compiler when policies allow", () => {
  resetTelemetryChannels(MANAGED_JIT_TELEMETRY_NAMESPACE);
  const vm = {
    Squeak: {
      Compiler: function managedCompiler(instance) {
        this.vm = instance;
        this.compile = () => {};
      }
    },
    image: {
      oldSpaceCount: 250000,
      startupTime: 0
    },
    startupTime: 1000
  };

  const controller = createManagedJITController({ vm });
  const result = controller.initialize();

  assert.equal(result.enabled, true);
  assert.ok(result.compiler);
  assert.ok(result.metrics.objectsPerSecond > 0);

  const channel = getTelemetryChannelState(MANAGED_JIT_TELEMETRY_NAMESPACE);
  assert.ok(channel);
  const enabledEvents = channel.history.filter((event) => event.type === "jit-enabled");
  assert.equal(enabledEvents.length, 1);
  assert.ok(enabledEvents[0].payload.metrics.objectsPerSecond > 0);
});

test("managed JIT controller reports dynamic code policy denials", () => {
  resetTelemetryChannels(MANAGED_JIT_TELEMETRY_NAMESPACE);
  const vm = {
    Squeak: {
      Compiler: function mockCompiler(instance) {
        this.vm = instance;
        this.compile = () => {};
      }
    },
    image: {
      oldSpaceCount: 250000,
      startupTime: 0
    },
    startupTime: 1000
  };

  const controller = createManagedJITController({
    vm,
    policy: {
      allowDynamicCode: () => ({
        allowed: false,
        detail: { policy: "sandbox" },
        message: "Dynamic code disallowed"
      })
    }
  });

  const result = controller.initialize();

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "dynamic-code-policy");
  assert.deepEqual(result.detail, { policy: "sandbox" });
  assert.equal(result.message, "Dynamic code disallowed");

  const channel = getTelemetryChannelState(MANAGED_JIT_TELEMETRY_NAMESPACE);
  assert.ok(channel);
  const disabledEvents = channel.history.filter((event) => event.type === "jit-disabled");
  assert.equal(disabledEvents.length, 1);
  assert.equal(disabledEvents[0].payload.reason, "dynamic-code-policy");
});

test("managed JIT controller guards slow machines by default", () => {
  resetTelemetryChannels(MANAGED_JIT_TELEMETRY_NAMESPACE);
  const vm = {
    Squeak: {
      Compiler: function managedCompiler(instance) {
        this.vm = instance;
        this.compile = () => {};
      }
    },
    image: {
      oldSpaceCount: 1000,
      startupTime: 0
    },
    startupTime: 1000
  };

  const controller = createManagedJITController({ vm });
  const result = controller.initialize();

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "slow-machine");
  assert.ok(result.detail.rate < result.detail.threshold);

  const channel = getTelemetryChannelState(MANAGED_JIT_TELEMETRY_NAMESPACE);
  assert.ok(channel);
  const disabledEvents = channel.history.filter((event) => event.type === "jit-disabled");
  assert.equal(disabledEvents.length, 1);
  assert.equal(disabledEvents[0].payload.reason, "slow-machine");
});

test("managed JIT controller respects dynamic code capability reports", () => {
  resetTelemetryChannels(MANAGED_JIT_TELEMETRY_NAMESPACE);
  const vm = {
    Squeak: {
      Compiler: function managedCompiler(instance) {
        this.vm = instance;
        this.compile = () => {};
      }
    },
    image: {
      oldSpaceCount: 250000,
      startupTime: 0
    },
    startupTime: 1000
  };

  const controller = createManagedJITController({
    vm,
    capabilities: {
      resource: {
        groups: {
          execution: {
            dynamicCode: {
              id: "execution.dynamicCode",
              label: "Dynamic code generation",
              supported: false,
              reason: "dynamic-code-blocked",
              error: { message: "csp" },
              permission: { state: "unknown" }
            }
          }
        }
      }
    }
  });

  const result = controller.initialize();

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "dynamic-code-capability");
  assert.equal(result.detail.capability.supported, false);
  assert.equal(result.detail.capability.reason, "dynamic-code-blocked");

  const channel = getTelemetryChannelState(MANAGED_JIT_TELEMETRY_NAMESPACE);
  const disabledEvents = channel.history.filter((event) => event.type === "jit-disabled");
  assert.equal(disabledEvents.length, 1);
  assert.equal(disabledEvents[0].payload.reason, "dynamic-code-capability");
});

test("managed JIT controller honors capability permission denials", () => {
  resetTelemetryChannels(MANAGED_JIT_TELEMETRY_NAMESPACE);
  const vm = {
    Squeak: {
      Compiler: function managedCompiler(instance) {
        this.vm = instance;
        this.compile = () => {};
      }
    },
    image: {
      oldSpaceCount: 250000,
      startupTime: 0
    },
    startupTime: 1000
  };

  const controller = createManagedJITController({
    vm,
    capabilities: {
      dynamicCode: {
        id: "execution.dynamicCode",
        label: "Dynamic code generation",
        supported: true,
        permission: { state: "denied", reason: "policy" }
      }
    }
  });

  const result = controller.initialize();

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "dynamic-code-capability");
  assert.equal(result.detail.capability.permission.state, "denied");
  assert.equal(result.message, "Managed JIT disabled: dynamic code permission denied");
});

test("managed JIT controller honors dynamic probe overrides", () => {
  resetTelemetryChannels(MANAGED_JIT_TELEMETRY_NAMESPACE);
  const vm = {
    Squeak: {
      Compiler: function managedCompiler(instance) {
        this.vm = instance;
        this.compile = () => {};
      }
    },
    image: {
      oldSpaceCount: 250000,
      startupTime: 0
    },
    startupTime: 1000
  };

  const controller = createManagedJITController({
    vm,
    policy: {
      dynamicProbe: () => ({
        allowed: false,
        detail: { error: { message: "blocked" } },
        message: "Dynamic compilation blocked"
      })
    }
  });

  const result = controller.initialize();

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "dynamic-code-blocked");
  assert.deepEqual(result.detail, { error: { message: "blocked" } });

  const channel = getTelemetryChannelState(MANAGED_JIT_TELEMETRY_NAMESPACE);
  assert.ok(channel);
  const disabledEvents = channel.history.filter((event) => event.type === "jit-disabled");
  assert.equal(disabledEvents.length, 1);
  assert.equal(disabledEvents[0].payload.reason, "dynamic-code-blocked");
});
