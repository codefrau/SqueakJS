"use strict";

import {
    setEmbeddedWasmPrototypeBinary,
    loadWasmPrototypeBinary,
    getWasmPrototypeStreamingResponse,
} from "./vm.execution.assets.js";

const wasmPrototypeWat = `(module
  (type $runLoop (func (param i32) (result i32)))
  (type $binary (func (param i32 i32) (result i32)))
  (type $const (func (result i32)))
  (import "env" "memory" (memory 4 32))
  (table funcref (elem $primitiveAdd $primitiveSub $primitiveMul $primitiveLessThan $primitiveGreaterThan $primitiveLessOrEqual $primitiveGreaterOrEqual $primitiveEqual $primitiveNotEqual))
  (func $runLoop (export "runLoop") (type $runLoop) (param $ctx i32) (result i32)
    (local $pc i32) (local $stackBase i32) (local $stackTop i32) (local $limit i32)
    (local $opcode i32) (local $value i32) (local $lhs i32) (local $rhs i32) (local $primitive i32)
    (local.set $pc (i32.load (local.get $ctx)))
    (local.set $stackBase (i32.load offset=4 (local.get $ctx)))
    (local.set $stackTop (i32.load offset=8 (local.get $ctx)))
    (local.set $limit (i32.load offset=12 (local.get $ctx)))
    (block $exit
      (loop $loop
        (br_if $exit (i32.le_s (local.get $limit) (i32.const 0)))
        (local.set $limit (i32.sub (local.get $limit) (i32.const 1)))
        (local.set $opcode (i32.load8_u (local.get $pc)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 1)))
        (block $default
          (block $primitive
            (block $mul
              (block $sub
                (block $add
                  (block $push32
                    (block $push8
                      (block $halt
                        (br_table $halt $push8 $push32 $add $sub $mul $primitive $default (local.get $opcode))
                      )
                      (local.set $value (i32.load8_s (local.get $pc)))
                      (local.set $pc (i32.add (local.get $pc) (i32.const 1)))
                      (i32.store (local.get $stackTop) (local.get $value))
                      (local.set $stackTop (i32.add (local.get $stackTop) (i32.const 4)))
                      (br $loop)
                    )
                    (local.set $value (i32.load (local.get $pc)))
                    (local.set $pc (i32.add (local.get $pc) (i32.const 4)))
                    (i32.store (local.get $stackTop) (local.get $value))
                    (local.set $stackTop (i32.add (local.get $stackTop) (i32.const 4)))
                    (br $loop)
                  )
                  (br_if $default (i32.lt_u (i32.sub (local.get $stackTop) (local.get $stackBase)) (i32.const 8)))
                  (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
                  (local.set $rhs (i32.load (local.get $stackTop)))
                  (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
                  (local.set $lhs (i32.load (local.get $stackTop)))
                  (local.set $value (i32.add (local.get $lhs) (local.get $rhs)))
                  (i32.store (local.get $stackTop) (local.get $value))
                  (local.set $stackTop (i32.add (local.get $stackTop) (i32.const 4)))
                  (br $loop)
                )
                (br_if $default (i32.lt_u (i32.sub (local.get $stackTop) (local.get $stackBase)) (i32.const 8)))
                (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
                (local.set $rhs (i32.load (local.get $stackTop)))
                (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
                (local.set $lhs (i32.load (local.get $stackTop)))
                (local.set $value (i32.sub (local.get $lhs) (local.get $rhs)))
                (i32.store (local.get $stackTop) (local.get $value))
                (local.set $stackTop (i32.add (local.get $stackTop) (i32.const 4)))
                (br $loop)
              )
              (br_if $default (i32.lt_u (i32.sub (local.get $stackTop) (local.get $stackBase)) (i32.const 8)))
              (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
              (local.set $rhs (i32.load (local.get $stackTop)))
              (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
              (local.set $lhs (i32.load (local.get $stackTop)))
              (local.set $value (i32.mul (local.get $lhs) (local.get $rhs)))
              (i32.store (local.get $stackTop) (local.get $value))
              (local.set $stackTop (i32.add (local.get $stackTop) (i32.const 4)))
              (br $loop)
            )
            (local.set $primitive (i32.load8_u (local.get $pc)))
            (local.set $pc (i32.add (local.get $pc) (i32.const 1)))
            (br_if $default (i32.ge_u (local.get $primitive) (i32.const 9)))
            (br_if $default (i32.lt_u (i32.sub (local.get $stackTop) (local.get $stackBase)) (i32.const 8)))
            (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
            (local.set $rhs (i32.load (local.get $stackTop)))
            (local.set $stackTop (i32.sub (local.get $stackTop) (i32.const 4)))
            (local.set $lhs (i32.load (local.get $stackTop)))
            (local.set $value (call_indirect (type $binary) (local.get $lhs) (local.get $rhs) (local.get $primitive)))
            (i32.store (local.get $stackTop) (local.get $value))
            (local.set $stackTop (i32.add (local.get $stackTop) (i32.const 4)))
            (br $loop)
          )
          (local.set $limit (i32.const 0))
          (br $exit)
        )
      )
    )
    (i32.store (local.get $ctx) (local.get $pc))
    (i32.store offset=4 (local.get $ctx) (local.get $stackBase))
    (i32.store offset=8 (local.get $ctx) (local.get $stackTop))
    (i32.store offset=12 (local.get $ctx) (local.get $limit))
    (return
      (block (result i32)
        (br_if 0 (i32.lt_u (i32.sub (local.get $stackTop) (local.get $stackBase)) (i32.const 4)))
        (br 1 (i32.load (i32.sub (local.get $stackTop) (i32.const 4))))
      )
      (i32.const 0)
    )
  )
  (func $primitiveAdd (export "primitiveAdd") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.add (local.get $lhs) (local.get $rhs)))
  (func $primitiveSub (export "primitiveSub") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.sub (local.get $lhs) (local.get $rhs)))
  (func $primitiveMul (export "primitiveMul") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.mul (local.get $lhs) (local.get $rhs)))
  (func $primitiveLessThan (export "primitiveLessThan") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.lt_s (local.get $lhs) (local.get $rhs)))
  (func $primitiveGreaterThan (export "primitiveGreaterThan") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.gt_s (local.get $lhs) (local.get $rhs)))
  (func $primitiveLessOrEqual (export "primitiveLessOrEqual") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.le_s (local.get $lhs) (local.get $rhs)))
  (func $primitiveGreaterOrEqual (export "primitiveGreaterOrEqual") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.ge_s (local.get $lhs) (local.get $rhs)))
  (func $primitiveEqual (export "primitiveEqual") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.eq (local.get $lhs) (local.get $rhs)))
  (func $primitiveNotEqual (export "primitiveNotEqual") (type $binary) (param $lhs i32) (param $rhs i32) (result i32)
    (i32.ne (local.get $lhs) (local.get $rhs)))
  (func $primitiveCount (export "primitiveCount") (type $const) (result i32)
    (i32.const 9))
  (export "memory" (memory 0))
)`;

const wasmPrototypeBinary = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x10, 0x03, 0x60, 0x01, 0x7f, 0x01, 0x7f,
    0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f, 0x60, 0x00,
    0x01, 0x7f, 0x02, 0x10, 0x01, 0x03, 0x65, 0x6e,
    0x76, 0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79,
    0x02, 0x01, 0x04, 0x20, 0x03, 0x0c, 0x0b, 0x00,
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x02, 0x04, 0x04, 0x01, 0x70, 0x00, 0x09,
    0x07, 0xd3, 0x01, 0x0c, 0x06, 0x6d, 0x65, 0x6d,
    0x6f, 0x72, 0x79, 0x02, 0x00, 0x07, 0x72, 0x75,
    0x6e, 0x4c, 0x6f, 0x6f, 0x70, 0x00, 0x00, 0x0c,
    0x70, 0x72, 0x69, 0x6d, 0x69, 0x74, 0x69, 0x76,
    0x65, 0x41, 0x64, 0x64, 0x00, 0x01, 0x0c, 0x70,
    0x72, 0x69, 0x6d, 0x69, 0x74, 0x69, 0x76, 0x65,
    0x53, 0x75, 0x62, 0x00, 0x02, 0x0c, 0x70, 0x72,
    0x69, 0x6d, 0x69, 0x74, 0x69, 0x76, 0x65, 0x4d,
    0x75, 0x6c, 0x00, 0x03, 0x11, 0x70, 0x72, 0x69,
    0x6d, 0x69, 0x74, 0x69, 0x76, 0x65, 0x4c, 0x65,
    0x73, 0x73, 0x54, 0x68, 0x61, 0x6e, 0x00, 0x04,
    0x14, 0x70, 0x72, 0x69, 0x6d, 0x69, 0x74, 0x69,
    0x76, 0x65, 0x47, 0x72, 0x65, 0x61, 0x74, 0x65,
    0x72, 0x54, 0x68, 0x61, 0x6e, 0x00, 0x05, 0x14,
    0x70, 0x72, 0x69, 0x6d, 0x69, 0x74, 0x69, 0x76,
    0x65, 0x4c, 0x65, 0x73, 0x73, 0x4f, 0x72, 0x45,
    0x71, 0x75, 0x61, 0x6c, 0x00, 0x06, 0x17, 0x70,
    0x72, 0x69, 0x6d, 0x69, 0x74, 0x69, 0x76, 0x65,
    0x47, 0x72, 0x65, 0x61, 0x74, 0x65, 0x72, 0x4f,
    0x72, 0x45, 0x71, 0x75, 0x61, 0x6c, 0x00, 0x07,
    0x0e, 0x70, 0x72, 0x69, 0x6d, 0x69, 0x74, 0x69,
    0x76, 0x65, 0x45, 0x71, 0x75, 0x61, 0x6c, 0x00,
    0x08, 0x11, 0x70, 0x72, 0x69, 0x6d, 0x69, 0x74,
    0x69, 0x76, 0x65, 0x4e, 0x6f, 0x74, 0x45, 0x71,
    0x75, 0x61, 0x6c, 0x00, 0x09, 0x0e, 0x70, 0x72,
    0x69, 0x6d, 0x69, 0x74, 0x69, 0x76, 0x65, 0x43,
    0x6f, 0x75, 0x6e, 0x74, 0x00, 0x0a, 0x09, 0x0f,
    0x01, 0x00, 0x41, 0x00, 0x0b, 0x09, 0x01, 0x02,
    0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
    0xd1, 0x04, 0x0b, 0x81, 0x04, 0x01, 0x09, 0x7f,
    0x20, 0x00, 0x28, 0x02, 0x00, 0x21, 0x01, 0x20,
    0x00, 0x41, 0x04, 0x6a, 0x28, 0x02, 0x00, 0x21,
    0x02, 0x20, 0x00, 0x41, 0x08, 0x6a, 0x28, 0x02,
    0x00, 0x21, 0x03, 0x20, 0x00, 0x41, 0x0c, 0x6a,
    0x28, 0x02, 0x00, 0x21, 0x04, 0x02, 0x40, 0x03,
    0x40, 0x20, 0x04, 0x41, 0x00, 0x4e, 0x0d, 0x01,
    0x20, 0x04, 0x41, 0x01, 0x6b, 0x21, 0x04, 0x20,
    0x01, 0x2d, 0x00, 0x00, 0x21, 0x05, 0x20, 0x01,
    0x41, 0x01, 0x6a, 0x21, 0x01, 0x02, 0x40, 0x02,
    0x40, 0x02, 0x40, 0x02, 0x40, 0x02, 0x40, 0x02,
    0x40, 0x02, 0x40, 0x02, 0x40, 0x0e, 0x07, 0x00,
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x41,
    0x00, 0x21, 0x04, 0x0c, 0x09, 0x0b, 0x20, 0x01,
    0x2c, 0x00, 0x00, 0x21, 0x06, 0x20, 0x01, 0x41,
    0x01, 0x6a, 0x21, 0x01, 0x20, 0x03, 0x20, 0x06,
    0x36, 0x02, 0x00, 0x20, 0x03, 0x41, 0x04, 0x6a,
    0x21, 0x03, 0x0c, 0x07, 0x0b, 0x20, 0x01, 0x28,
    0x02, 0x00, 0x21, 0x06, 0x20, 0x01, 0x41, 0x04,
    0x6a, 0x21, 0x01, 0x20, 0x03, 0x20, 0x06, 0x36,
    0x02, 0x00, 0x20, 0x03, 0x41, 0x04, 0x6a, 0x21,
    0x03, 0x0c, 0x06, 0x0b, 0x20, 0x03, 0x20, 0x02,
    0x6b, 0x41, 0x08, 0x49, 0x0d, 0x04, 0x20, 0x03,
    0x41, 0x04, 0x6b, 0x21, 0x03, 0x20, 0x03, 0x28,
    0x02, 0x00, 0x21, 0x08, 0x20, 0x03, 0x41, 0x04,
    0x6b, 0x21, 0x03, 0x20, 0x03, 0x28, 0x02, 0x00,
    0x21, 0x07, 0x20, 0x07, 0x20, 0x08, 0x6a, 0x21,
    0x06, 0x20, 0x03, 0x20, 0x06, 0x36, 0x02, 0x00,
    0x20, 0x03, 0x41, 0x04, 0x6a, 0x21, 0x03, 0x0c,
    0x05, 0x0b, 0x20, 0x03, 0x20, 0x02, 0x6b, 0x41,
    0x08, 0x49, 0x0d, 0x03, 0x20, 0x03, 0x41, 0x04,
    0x6b, 0x21, 0x03, 0x20, 0x03, 0x28, 0x02, 0x00,
    0x21, 0x08, 0x20, 0x03, 0x41, 0x04, 0x6b, 0x21,
    0x03, 0x20, 0x03, 0x28, 0x02, 0x00, 0x21, 0x07,
    0x20, 0x07, 0x20, 0x08, 0x6b, 0x21, 0x06, 0x20,
    0x03, 0x20, 0x06, 0x36, 0x02, 0x00, 0x20, 0x03,
    0x41, 0x04, 0x6a, 0x21, 0x03, 0x0c, 0x04, 0x0b,
    0x20, 0x03, 0x20, 0x02, 0x6b, 0x41, 0x08, 0x49,
    0x0d, 0x02, 0x20, 0x03, 0x41, 0x04, 0x6b, 0x21,
    0x03, 0x20, 0x03, 0x28, 0x02, 0x00, 0x21, 0x08,
    0x20, 0x03, 0x41, 0x04, 0x6b, 0x21, 0x03, 0x20,
    0x03, 0x28, 0x02, 0x00, 0x21, 0x07, 0x20, 0x07,
    0x20, 0x08, 0x6c, 0x21, 0x06, 0x20, 0x03, 0x20,
    0x06, 0x36, 0x02, 0x00, 0x20, 0x03, 0x41, 0x04,
    0x6a, 0x21, 0x03, 0x0c, 0x03, 0x0b, 0x20, 0x01,
    0x2d, 0x00, 0x00, 0x21, 0x09, 0x20, 0x01, 0x41,
    0x01, 0x6a, 0x21, 0x01, 0x20, 0x09, 0x41, 0x09,
    0x4d, 0x0d, 0x01, 0x20, 0x03, 0x20, 0x02, 0x6b,
    0x41, 0x08, 0x49, 0x0d, 0x01, 0x20, 0x03, 0x41,
    0x04, 0x6b, 0x21, 0x03, 0x20, 0x03, 0x28, 0x02,
    0x00, 0x21, 0x08, 0x20, 0x03, 0x41, 0x04, 0x6b,
    0x21, 0x03, 0x20, 0x03, 0x28, 0x02, 0x00, 0x21,
    0x07, 0x20, 0x07, 0x20, 0x08, 0x11, 0x01, 0x00,
    0x21, 0x06, 0x20, 0x03, 0x20, 0x06, 0x36, 0x02,
    0x00, 0x20, 0x03, 0x41, 0x04, 0x6a, 0x21, 0x03,
    0x0c, 0x02, 0x0b, 0x41, 0x00, 0x21, 0x04, 0x0c,
    0x02, 0x0b, 0x0b, 0x0b, 0x20, 0x00, 0x20, 0x01,
    0x36, 0x02, 0x00, 0x20, 0x00, 0x41, 0x04, 0x6a,
    0x20, 0x02, 0x36, 0x02, 0x00, 0x20, 0x00, 0x41,
    0x08, 0x6a, 0x20, 0x03, 0x36, 0x02, 0x00, 0x20,
    0x00, 0x41, 0x0c, 0x6a, 0x20, 0x04, 0x36, 0x02,
    0x00, 0x02, 0x7f, 0x20, 0x03, 0x20, 0x02, 0x6b,
    0x41, 0x04, 0x49, 0x04, 0x40, 0x41, 0x00, 0x0c,
    0x01, 0x0b, 0x20, 0x03, 0x41, 0x04, 0x6b, 0x28,
    0x02, 0x00, 0x0c, 0x01, 0x0b, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x6b, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x6c, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x48, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x4a, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x4c, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x4e, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x46, 0x0b, 0x07, 0x00,
    0x20, 0x00, 0x20, 0x01, 0x47, 0x0b, 0x04, 0x00,
    0x41, 0x09, 0x0b,
]);

setEmbeddedWasmPrototypeBinary(wasmPrototypeBinary);

const wasmPrototypeOpcodes = Object.freeze({
    HALT: 0,
    PUSH_INT8: 1,
    PUSH_INT32: 2,
    ADD: 3,
    SUB: 4,
    MUL: 5,
    PRIMITIVE_CALL: 6,
});

const wasmPrototypePrimitiveNames = Object.freeze([
    "primitiveAdd",
    "primitiveSub",
    "primitiveMul",
    "primitiveLessThan",
    "primitiveGreaterThan",
    "primitiveLessOrEqual",
    "primitiveGreaterOrEqual",
    "primitiveEqual",
    "primitiveNotEqual",
]);

const wasmPrototypeLayout = Object.freeze({
    contextSize: 16,
    offsets: Object.freeze({
        pc: 0,
        stackBase: 4,
        stackTop: 8,
        budget: 12,
    }),
});

const primitiveArithmeticMap = Object.freeze({ 0: 0, 1: 1, 2: 2 });
const primitiveCompareMap = Object.freeze({ 0: 3, 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 });

const DEFAULT_MEMORY_OPTIONS = Object.freeze({
    initialPages: 4,
    maximumPages: 32,
    shared: true,
});

let instantiatePromise = null;
let cachedInstance = null;
let cachedMemory = null;
let cachedMemoryInfo = null;

function supportsSharedMemory() {
    try {
        return typeof SharedArrayBuffer === "function" && typeof Atomics === "object";
    } catch (_) {
        return false;
    }
}

function createPrototypeMemory(options) {
    const opts = options || {};
    const initial = Math.max(1, opts.initialPages | 0 || DEFAULT_MEMORY_OPTIONS.initialPages);
    const maximum = Math.max(initial, opts.maximumPages | 0 || DEFAULT_MEMORY_OPTIONS.maximumPages);
    const allowShared = opts.shared !== false && DEFAULT_MEMORY_OPTIONS.shared && supportsSharedMemory();
    try {
        const memory = new WebAssembly.Memory({ initial, maximum, shared: allowShared });
        return { memory, initial, maximum, shared: allowShared && memory.buffer instanceof SharedArrayBuffer };
    } catch (_) {
        const memory = new WebAssembly.Memory({ initial, maximum });
        return { memory, initial, maximum, shared: false };
    }
}

function mergeImports(target, source) {
    if (!source) return target;
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const value = source[key];
        if (value && typeof value === "object" && !Array.isArray(value)) {
            result[key] = mergeImports(result[key] || {}, value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

function prepareImports(imports) {
    if (imports && imports.env && imports.env.memory instanceof WebAssembly.Memory) {
        return {
            imports,
            memoryInfo: {
                memory: imports.env.memory,
                initial: imports.env.memory.initial ?? null,
                maximum: imports.env.memory.maximum ?? null,
                shared: imports.env.memory.buffer instanceof SharedArrayBuffer,
            },
        };
    }
    const memoryInfo = cachedMemory ? { memory: cachedMemory, shared: cachedMemoryInfo && cachedMemoryInfo.shared } : createPrototypeMemory();
    const baseImports = { env: { memory: memoryInfo.memory } };
    return {
        imports: mergeImports(baseImports, imports),
        memoryInfo,
    };
}

function normalizeInstantiateResult(result) {
    if (!result) return null;
    if (result.instance && result.module) {
        return { module: result.module, exports: result.instance.exports };
    }
    if (typeof WebAssembly === "object" && typeof WebAssembly.Instance === "function" && result instanceof WebAssembly.Instance) {
        return { module: null, exports: result.exports };
    }
    if (result.exports) {
        return { module: result.module || null, exports: result.exports };
    }
    return null;
}

async function instantiateFromBinary(imports, binary) {
    const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    if (typeof WebAssembly.Module === "function" && typeof WebAssembly.Instance === "function") {
        try {
            const module = new WebAssembly.Module(bytes);
            const instance = new WebAssembly.Instance(module, imports);
            return { module, exports: instance.exports };
        } catch (_) {
            // fall back to instantiate
        }
    }
    if (typeof WebAssembly.instantiate !== "function") {
        throw new Error("WebAssembly.instantiate is not available in this environment");
    }
    const instantiated = await WebAssembly.instantiate(bytes, imports);
    return normalizeInstantiateResult(instantiated);
}

async function tryInstantiateStreaming(imports) {
    const streamingSource = await getWasmPrototypeStreamingResponse();
    if (!streamingSource) return null;
    try {
        const instantiated = await WebAssembly.instantiateStreaming(streamingSource.response, imports);
        return normalizeInstantiateResult(instantiated);
    } catch (_) {
        if (streamingSource.binary) {
            return instantiateFromBinary(imports, streamingSource.binary);
        }
        return null;
    }
}

function instantiatePrototype(imports) {
    if (cachedInstance) {
        if (!instantiatePromise) {
            instantiatePromise = Promise.resolve(cachedInstance);
        }
        return instantiatePromise;
    }
    if (instantiatePromise) {
        return instantiatePromise;
    }
    if (typeof WebAssembly !== "object") {
        const error = new Error("WebAssembly is not available in this environment");
        instantiatePromise = Promise.reject(error);
        return instantiatePromise;
    }
    const prepared = prepareImports(imports);
    instantiatePromise = (async function instantiate() {
        try {
            const streaming = await tryInstantiateStreaming(prepared.imports);
            if (streaming) {
                cachedInstance = streaming;
            } else {
                const binary = await loadWasmPrototypeBinary();
                cachedInstance = await instantiateFromBinary(prepared.imports, binary);
            }
            cachedMemory = prepared.memoryInfo.memory;
            cachedMemoryInfo = prepared.memoryInfo;
            return cachedInstance;
        } finally {
            instantiatePromise = null;
        }
    })();
    return instantiatePromise;
}

function getCachedExports() {
    return cachedInstance ? cachedInstance.exports : null;
}

export function ensureWasmPrototypeInstance(imports) {
    if (cachedInstance) return cachedInstance.exports;
    instantiatePrototype(imports).catch(function() {});
    return getCachedExports();
}

export async function getWasmPrototypeInstance(imports) {
    const instantiated = await instantiatePrototype(imports);
    return instantiated.exports;
}

export function resetWasmPrototypeInstance() {
    instantiatePromise = null;
    cachedInstance = null;
}

export function getWasmPrototypeMemory() {
    if (cachedMemory) return cachedMemory;
    ensureWasmPrototypeInstance();
    return cachedMemory;
}

export function getWasmPrototypeOpcodes() {
    return wasmPrototypeOpcodes;
}

export function getWasmPrototypeLayout() {
    return wasmPrototypeLayout;
}

export function getWasmPrototypePrimitiveNames() {
    return wasmPrototypePrimitiveNames;
}

function getPrimitiveFunction(exports, index) {
    if (!exports || index < 0 || index >= wasmPrototypePrimitiveNames.length) return null;
    const name = wasmPrototypePrimitiveNames[index];
    const fn = exports[name];
    return typeof fn === "function" ? fn : null;
}

export function binaryIntOpSync(op, lhs, rhs) {
    const exports = ensureWasmPrototypeInstance();
    const primitiveIndex = primitiveArithmeticMap[op | 0];
    const fn = getPrimitiveFunction(exports, primitiveIndex);
    if (!fn) return null;
    return fn(lhs | 0, rhs | 0) | 0;
}

export function binaryCompareOpSync(op, lhs, rhs) {
    const exports = ensureWasmPrototypeInstance();
    const primitiveIndex = primitiveCompareMap[op | 0];
    const fn = getPrimitiveFunction(exports, primitiveIndex);
    if (!fn) return null;
    return fn(lhs | 0, rhs | 0) | 0;
}

export function binarySeriesOpSync(op, lhs, rhs, iterations) {
    const exports = ensureWasmPrototypeInstance();
    const primitiveIndex = primitiveArithmeticMap[op | 0];
    const fn = getPrimitiveFunction(exports, primitiveIndex);
    if (!fn) return null;
    const count = Math.max(0, iterations | 0);
    let result = 0;
    for (let i = 0; i < count; i++) {
        const value = fn((lhs + i) | 0, (rhs + i) | 0) | 0;
        result = (result ^ value) | 0;
    }
    return result | 0;
}

function clampToRange(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

export function createPrototypeInterpreterHarness(options = {}) {
    const exports = ensureWasmPrototypeInstance();
    const memory = getWasmPrototypeMemory();
    if (!exports || !memory) {
        throw new Error("Unable to instantiate WebAssembly prototype");
    }
    const buffer = memory.buffer;
    const layout = {
        contextOffset: options.contextOffset == null ? 0 : options.contextOffset | 0,
        bytecodeOffset: options.bytecodeOffset == null ? 64 : options.bytecodeOffset | 0,
        bytecodeCapacity: clampToRange(options.bytecodeCapacity == null ? 4096 : options.bytecodeCapacity | 0, 64, buffer.byteLength - 64),
        stackOffset: options.stackOffset == null ? 4096 : options.stackOffset | 0,
        stackCapacity: clampToRange(options.stackCapacity == null ? 1024 : options.stackCapacity | 0, 16, (buffer.byteLength / 4) | 0),
    };
    const contextView = new DataView(buffer, layout.contextOffset, wasmPrototypeLayout.contextSize);
    const bytecodeView = new Uint8Array(buffer, layout.bytecodeOffset, layout.bytecodeCapacity);
    const stackView = new Int32Array(buffer, layout.stackOffset, layout.stackCapacity);

    function setContextField(offset, value) {
        contextView.setInt32(offset, value | 0, true);
    }

    function getContextField(offset) {
        return contextView.getInt32(offset, true) | 0;
    }

    function resetContext(contextOptions) {
        const opts = contextOptions || {};
        const pc = opts.pc == null ? layout.bytecodeOffset : opts.pc | 0;
        const stackBase = opts.stackBase == null ? layout.stackOffset : opts.stackBase | 0;
        const stackTop = opts.stackTop == null ? stackBase : opts.stackTop | 0;
        const budget = opts.limit == null ? 0 : opts.limit | 0;
        setContextField(wasmPrototypeLayout.offsets.pc, pc);
        setContextField(wasmPrototypeLayout.offsets.stackBase, stackBase);
        setContextField(wasmPrototypeLayout.offsets.stackTop, stackTop);
        setContextField(wasmPrototypeLayout.offsets.budget, budget);
        return { pc, stackBase, stackTop, limit: budget };
    }

    function loadStack(values) {
        const array = Array.isArray(values) || values instanceof Int32Array ? values : [];
        if (!array.length) {
            const base = getContextField(wasmPrototypeLayout.offsets.stackBase);
            setContextField(wasmPrototypeLayout.offsets.stackTop, base);
            return base;
        }
        const base = getContextField(wasmPrototypeLayout.offsets.stackBase);
        const target = new Int32Array(buffer, base, array.length);
        for (let i = 0; i < array.length; i++) {
            target[i] = array[i] | 0;
        }
        const top = base + (array.length << 2);
        setContextField(wasmPrototypeLayout.offsets.stackTop, top);
        return top;
    }

    function setBytecodes(bytes, offset) {
        const targetOffset = offset == null ? layout.bytecodeOffset : offset | 0;
        const relative = targetOffset - layout.bytecodeOffset;
        if (relative < 0 || relative >= layout.bytecodeCapacity) {
            throw new RangeError("Bytecode offset is outside the configured buffer slice");
        }
        const input = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
        if (input.length > layout.bytecodeCapacity - relative) {
            throw new RangeError("Bytecode payload exceeds configured capacity");
        }
        bytecodeView.set(input, relative);
        return targetOffset + input.length;
    }

    function getContextSnapshot() {
        return {
            pc: getContextField(wasmPrototypeLayout.offsets.pc),
            stackBase: getContextField(wasmPrototypeLayout.offsets.stackBase),
            stackTop: getContextField(wasmPrototypeLayout.offsets.stackTop),
            limit: getContextField(wasmPrototypeLayout.offsets.budget),
        };
    }

    function run(limitOverride) {
        if (limitOverride != null) {
            setContextField(wasmPrototypeLayout.offsets.budget, limitOverride | 0);
        }
        const result = exports.runLoop(layout.contextOffset >>> 0) | 0;
        return {
            result,
            context: getContextSnapshot(),
        };
    }

    resetContext();

    return Object.freeze({
        exports,
        memory,
        layout: { ...layout },
        contextView,
        bytecodeView,
        stackView,
        resetContext,
        loadStack,
        setBytecodes,
        getContextSnapshot,
        run,
    });
}

function getPrimitiveCount() {
    const exports = ensureWasmPrototypeInstance();
    const fn = exports && typeof exports.primitiveCount === "function" ? exports.primitiveCount : null;
    return fn ? fn() | 0 : wasmPrototypePrimitiveNames.length;
}

export function getWasmPrototypeBinary() {
    return wasmPrototypeBinary.slice();
}

export function getWasmPrototypeWat() {
    return wasmPrototypeWat;
}

if (typeof globalThis === "object") {
    if (!globalThis.Squeak) globalThis.Squeak = {};
    if (!globalThis.Squeak.experimental) globalThis.Squeak.experimental = {};
    globalThis.Squeak.experimental.wasmPrototype = {
        get binary() { return getWasmPrototypeBinary(); },
        get wat() { return getWasmPrototypeWat(); },
        get opcodes() { return getWasmPrototypeOpcodes(); },
        get layout() { return getWasmPrototypeLayout(); },
        get primitives() { return wasmPrototypePrimitiveNames.slice(); },
        primitiveCount: getPrimitiveCount,
        createHarness: createPrototypeInterpreterHarness,
        reset: resetWasmPrototypeInstance,
    };
}

export const wasmPrototypeMetadata = Object.freeze({
    name: "interpreter-hotspot-prototype",
    description: "Stack-oriented bytecode interpreter prototype with primitive dispatch table",
    instructions: 891,
    locals: 9,
    exports: [
        "memory",
        "runLoop",
        ...wasmPrototypePrimitiveNames,
        "primitiveCount",
    ],
    opcodes: wasmPrototypeOpcodes,
    primitiveCount: wasmPrototypePrimitiveNames.length,
    contextLayout: wasmPrototypeLayout,
});

export default {
    ensureWasmPrototypeInstance,
    getWasmPrototypeInstance,
    resetWasmPrototypeInstance,
    getWasmPrototypeMemory,
    getWasmPrototypeOpcodes,
    getWasmPrototypeLayout,
    getWasmPrototypePrimitiveNames,
    getWasmPrototypeBinary,
    getWasmPrototypeWat,
    binaryIntOpSync,
    binaryCompareOpSync,
    binarySeriesOpSync,
    createPrototypeInterpreterHarness,
    metadata: wasmPrototypeMetadata,
};
