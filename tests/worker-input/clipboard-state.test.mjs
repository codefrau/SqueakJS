"use strict";

import assert from "assert";
import { WorkerVMController } from "../../vm.worker.host.js";

async function runStateDiagnosticsScenario() {
    const controller = new WorkerVMController();
    controller.worker = { postMessage() {} };

    controller.setClipboardText("baseline", { timestamp: 2000 });
    assert.strictEqual(controller._clipboardState.text, "baseline");
    assert.strictEqual(controller._clipboardState.cachedAt, 2000);

    controller.setClipboardText("stale", { timestamp: 1500 });
    assert.strictEqual(controller._clipboardState.text, "baseline");
    assert.ok(controller._clipboardState.staleDrops >= 1);

    controller._handleMessage({ type: "clipboard-set", text: "worker", timestamp: 3000, changed: true });
    assert.strictEqual(controller._clipboardState.text, "worker");
    assert.strictEqual(controller._clipboardState.cachedAt, 3000);

    const diagnostics = controller.getClipboardDiagnostics();
    assert.strictEqual(diagnostics.text, "worker");
    assert.strictEqual(diagnostics.staleDrops, controller._clipboardState.staleDrops);
    assert.strictEqual(diagnostics.queuePending, 0);
}

await runStateDiagnosticsScenario();
