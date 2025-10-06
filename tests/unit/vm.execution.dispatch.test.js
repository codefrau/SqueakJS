import test from "node:test";
import assert from "node:assert/strict";

import { createBytecodeDispatcher } from "../../vm.execution.dispatch.js";

test("bytecode dispatcher invokes instrumentation hooks", () => {
  const opcodes = [0xD0];
  const events = [];
  const vm = {
    Squeak: {},
    byteCodeCount: 0,
    receiver: { pointers: [42] },
    homeContext: { pointers: [] },
    method: {
      methodSignFlag: () => false,
      methodGetSelector: (index) => ({ hash: index })
    },
    primHandler: { quickSendOther: () => true },
    nextByte: () => {
      if (!opcodes.length) throw new Error("no more opcodes");
      return opcodes.shift();
    },
    push: () => {},
    send: () => {},
    sendSpecial: () => {},
    callPrimBytecode: () => {},
    _vmdbgEnabledParser: () => false
  };

  const dispatcher = createBytecodeDispatcher(vm, {
    beforeOpcode: (event) => events.push({ type: "before", event }),
    onSend: (event) => events.push({ type: "send", event })
  });

  dispatcher.execute(false);

  assert.equal(events.length, 2);
  assert.equal(events[0].type, "before");
  assert.equal(events[0].event.opcode, 0xD0);
  assert.equal(events[1].type, "send");
  assert.equal(events[1].event.opcode, 0xD0);
  assert.equal(events[1].event.argCount, 0);
});
