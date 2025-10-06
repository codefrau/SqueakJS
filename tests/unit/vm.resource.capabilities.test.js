import test from "node:test";
import assert from "node:assert/strict";

import {
  collectResourceCapabilityMatrix,
  ensureResourceCapabilityReport,
  getResourceCapabilityReport,
  __resetResourceCapabilityCacheForTests
} from "../../vm.resource.capabilities.js";

const ISO = (value) => new Date(value).toISOString();

test("collectResourceCapabilityMatrix handles missing browser APIs", async () => {
  const now = () => 1700000000000;
  const report = await collectResourceCapabilityMatrix({ global: {}, now });

  assert.equal(report.version, 1);
  assert.equal(report.generatedAt, ISO(now()));
  assert.ok(report.groups.clipboard);
  assert.equal(report.groups.clipboard.read.supported, false);
  assert.equal(report.groups.clipboard.read.permission.state, "unknown");
  assert.equal(report.groups.audio.output.supported, false);
  assert.ok(report.groups.execution);
  assert.equal(report.groups.execution.dynamicCode.supported, true);
});

test("collectResourceCapabilityMatrix queries available permission interfaces", async () => {
  const queryNames = [];
  const permissionStates = {
    microphone: "granted",
    camera: "prompt",
    "clipboard-read": "granted",
    "clipboard-write": "denied",
    "wake-lock": "granted",
    "storage-access": "prompt"
  };
  const global = {
    navigator: {
      mediaDevices: {
        getUserMedia() {}
      },
      clipboard: {
        readText() {},
        writeText() {}
      },
      permissions: {
        query: ({ name }) => {
          queryNames.push(name);
          return Promise.resolve({ state: permissionStates[name] || "prompt" });
        }
      },
      wakeLock: {}
    },
    document: {
      fullscreenEnabled: true,
      body: {
        requestPointerLock() {}
      },
      requestStorageAccess() {}
    },
    AudioContext: function AudioContext() {}
  };
  function Notification() {}
  Notification.permission = "denied";
  global.Notification = Notification;

  const now = () => 1711111111111;
  const report = await collectResourceCapabilityMatrix({ global, now });

  assert.deepEqual(queryNames, [
    "microphone",
    "camera",
    "clipboard-read",
    "clipboard-write",
    "wake-lock",
    "storage-access"
  ]);
  assert.equal(report.generatedAt, ISO(now()));
  assert.equal(report.groups.audio.input.permission.state, "granted");
  assert.equal(report.groups.clipboard.write.permission.state, "denied");
  assert.equal(report.groups.notifications.default.permission.state, "denied");
  assert.equal(report.groups.display.fullscreen.permission.state, "granted");
  assert.equal(report.groups.audio.output.supported, true);
  assert.equal(report.groups.power.screenWakeLock.supported, true);
  assert.equal(report.groups.storage.access.permission.state, "prompt");
  assert.equal(report.groups.execution.dynamicCode.supported, true);
  assert.equal(report.groups.execution.dynamicCode.details.functionConstructor, true);
});

test("collectResourceCapabilityMatrix reports dynamic code restrictions", async () => {
  const now = () => 1722222222222;
  const global = {
    Function: function BlockedFunction() {
      throw Object.assign(new Error("blocked"), { code: "csp" });
    }
  };

  const report = await collectResourceCapabilityMatrix({ global, now });

  const capability = report.groups.execution.dynamicCode;
  assert.equal(capability.supported, false);
  assert.equal(capability.reason, "dynamic-code-blocked");
  assert.equal(capability.error.code, "csp");
  assert.equal(capability.permission.state, "unknown");
});

test("ensureResourceCapabilityReport caches results and updates browser state", async () => {
  const global = {};
  __resetResourceCapabilityCacheForTests({ global });

  const first = await ensureResourceCapabilityReport({ global, now: () => 1818181818000 });
  assert.ok(global.Squeak);
  assert.ok(global.Squeak.BrowserVMState);
  assert.strictEqual(global.Squeak.BrowserVMState.resourceCapabilities, first);
  assert.strictEqual(getResourceCapabilityReport(), first);

  const second = await ensureResourceCapabilityReport({ global, now: () => 1818181819000 });
  assert.strictEqual(first, second, "cached report should be reused");

  const forced = await ensureResourceCapabilityReport({ global, now: () => 1818181820000, force: true });
  assert.notStrictEqual(first, forced, "forced detection regenerates the report");
  assert.strictEqual(global.Squeak.BrowserVMState.resourceCapabilities, forced);
});
