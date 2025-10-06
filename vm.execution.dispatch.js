"use strict";

import { dispatchClassic } from "./vm.execution.dispatch.core.js";

export function createBytecodeDispatcher(vm, hooks) {
  const instrumentation = hooks && typeof hooks === "object" ? hooks : {};
  const originalSend = vm && typeof vm.send === "function" ? vm.send.bind(vm) : null;
  const originalSendSpecial = vm && typeof vm.sendSpecial === "function" ? vm.sendSpecial.bind(vm) : null;
  const originalQuickSendOther = vm && vm.primHandler && typeof vm.primHandler.quickSendOther === "function"
    ? vm.primHandler.quickSendOther.bind(vm.primHandler)
    : null;
  const originalCallPrimBytecode = vm && typeof vm.callPrimBytecode === "function" ? vm.callPrimBytecode.bind(vm) : null;

  function notify(event, detail) {
    if (!instrumentation) return;
    const handler = instrumentation[event];
    if (typeof handler !== "function") return;
    try {
      handler(detail);
    } catch (_) {
      // ignore instrumentation failures
    }
  }

  let currentOpcode = null;

  function beforeOpcode(opcode, singleStep) {
    currentOpcode = opcode;
    notify("beforeOpcode", { opcode, singleStep, vm });
  }

  function sendWithInstrumentation(selector, argCount, isSuper) {
    notify("onSend", { selector, argCount, super: !!isSuper, vm, opcode: currentOpcode });
    if (!originalSend) throw new Error("Interpreter send method unavailable");
    return originalSend(selector, argCount, isSuper);
  }

  let suppressNextSendSpecialNotification = false;

  function sendSpecialWithInstrumentation(index) {
    if (suppressNextSendSpecialNotification) {
      suppressNextSendSpecialNotification = false;
      if (!originalSendSpecial) throw new Error("Interpreter sendSpecial method unavailable");
      return originalSendSpecial(index);
    }
    notify("onSendSpecial", { index, vm, opcode: currentOpcode });
    if (!originalSendSpecial) throw new Error("Interpreter sendSpecial method unavailable");
    return originalSendSpecial(index);
  }

  function quickSendOtherWithInstrumentation(receiver, index) {
    if (!originalQuickSendOther) throw new Error("Interpreter quickSendOther unavailable");
    const result = originalQuickSendOther(receiver, index);
    if (!result) {
      suppressNextSendSpecialNotification = true;
      notify("onSendSpecial", { index: (index + 16) | 0, vm, quickFallback: true, opcode: currentOpcode });
    }
    return result;
  }

  function callPrimitiveBytecode(index) {
    notify("onPrimitiveCall", { index, vm, opcode: currentOpcode });
    if (!originalCallPrimBytecode) throw new Error("Interpreter primitive dispatch unavailable");
    return originalCallPrimBytecode(index);
  }

  function execute(singleStep) {
    return dispatchClassic(
      vm,
      {
        beforeOpcode,
        send: sendWithInstrumentation,
        sendSpecial: sendSpecialWithInstrumentation,
        quickSendOther: quickSendOtherWithInstrumentation,
        callPrimitive: callPrimitiveBytecode
      },
      singleStep
    );
  }

  return {
    execute,
    instrumentation
  };
}
