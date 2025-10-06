import test from "node:test";
import assert from "node:assert/strict";

import { createBytecodeDispatcher } from "../../vm.execution.dispatch.js";

test("bytecode dispatcher invokes send instrumentation hooks", () => {
  const opcodes = [0x83, 0x05];
  const events = [];
  const vm = {
    Squeak: {},
    byteCodeCount: 0,
    receiver: { pointers: [42] },
    homeContext: { pointers: [] },
    method: {
      methodSignFlag: () => false,
      methodGetSelector: (index) => ({ hash: index, selector: index })
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

  dispatcher.execute(true);

  assert.equal(events.length, 2);
  assert.equal(events[0].type, "before");
  assert.equal(events[0].event.opcode, 0x83);
  assert.equal(events[0].event.singleStep, true);
  assert.equal(events[1].type, "send");
  assert.equal(events[1].event.opcode, 0x83);
  assert.equal(events[1].event.argCount, 0);
  assert.equal(events[1].event.selector.hash, 5);
});

test("dispatcher forwards quick send fallbacks to sendSpecial instrumentation", () => {
  const opcodes = [0xC0];
  const events = [];
  const vm = {
    Squeak: {},
    byteCodeCount: 0,
    receiver: {},
    homeContext: { pointers: [] },
    method: {
      methodSignFlag: () => false,
      methodGetSelector: () => ({ hash: 0 })
    },
    primHandler: {
      quickSendOther: () => false
    },
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
    beforeOpcode: () => {},
    onSendSpecial: (event) => events.push(event)
  });

  dispatcher.execute(false);

  assert.equal(events.length, 1);
  assert.equal(events[0].index, 16);
  assert.equal(events[0].quickFallback, true);
  assert.equal(events[0].opcode, 0xC0);
});

test("dispatcher instruments primitive bytecode calls and ignores handler failures", () => {
  const opcodes = [0x8B];
  const received = [];
  const vm = {
    Squeak: {},
    byteCodeCount: 0,
    receiver: {},
    homeContext: { pointers: [] },
    method: {
      methodSignFlag: () => false,
      methodGetSelector: () => ({ hash: 0 })
    },
    primHandler: {
      quickSendOther: () => true
    },
    nextByte: () => {
      if (!opcodes.length) throw new Error("no more opcodes");
      return opcodes.shift();
    },
    push: () => {},
    send: () => {},
    sendSpecial: () => {},
    callPrimBytecode: (index) => {
      received.push(index);
    },
    _vmdbgEnabledParser: () => false
  };

  const dispatcher = createBytecodeDispatcher(vm, {
    beforeOpcode: () => {},
    onPrimitiveCall: (event) => {
      received.push(event.index);
      throw new Error("ignore me");
    }
  });

  dispatcher.execute(false);

  assert.deepEqual(received, [0x81, 0x81]);
});
