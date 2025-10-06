#!/usr/bin/env node
function encodeU32(value) {
  const bytes = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v) byte |= 0x80;
    bytes.push(byte);
  } while (v);
  return bytes;
}

function encodeVector(elements) {
  const payload = [];
  for (const element of elements) payload.push(...element);
  return [...encodeU32(elements.length), ...payload];
}

function encodeName(name) {
  const bytes = Array.from(Buffer.from(name, "utf8"));
  return [...encodeU32(bytes.length), ...bytes];
}

function encodeLocals(locals) {
  const payload = [];
  for (const local of locals) {
    payload.push(...encodeU32(local.count));
    payload.push(local.type);
  }
  return [...encodeU32(locals.length), ...payload];
}

function encodeInstruction(body, ...bytes) {
  body.push(...bytes);
}

function createModule() {
  const bytes = [];
  bytes.push(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);

  const sections = [];

  const typeSection = [];
  const types = [
    [0x60, ...encodeU32(1), 0x7f, ...encodeU32(1), 0x7f], // runLoop(ctxPtr) -> i32
    [0x60, ...encodeU32(2), 0x7f, 0x7f, ...encodeU32(1), 0x7f], // binary primitive
    [0x60, ...encodeU32(0), ...encodeU32(1), 0x7f], // primitiveCount
  ];
  typeSection.push(...encodeVector(types));
  sections.push({ id: 1, data: typeSection });

  const importSection = [];
  const imports = [];
  // import memory env.memory (min 4 pages, max 32 pages)
  imports.push([
    ...encodeName("env"),
    ...encodeName("memory"),
    0x02,
    0x01,
    ...encodeU32(4),
    ...encodeU32(32),
  ]);
  importSection.push(...encodeVector(imports));
  sections.push({ id: 2, data: importSection });

  const funcSection = [];
  const functionTypeIndexes = [
    0, // runLoop
    1, // primitiveAdd
    1, // primitiveSub
    1, // primitiveMul
    1, // primitiveLessThan
    1, // primitiveGreaterThan
    1, // primitiveLessOrEqual
    1, // primitiveGreaterOrEqual
    1, // primitiveEqual
    1, // primitiveNotEqual
    2, // primitiveCount
  ];
  funcSection.push(...encodeVector(functionTypeIndexes.map(index => encodeU32(index))));
  sections.push({ id: 3, data: funcSection });

  const tableSection = [];
  tableSection.push(...encodeU32(1));
  tableSection.push(0x70);
  tableSection.push(0x00);
  tableSection.push(...encodeU32(9));
  sections.push({ id: 4, data: tableSection });

  const exportSection = [];
  const exportEntries = [
    { name: "memory", kind: 0x02, index: 0 },
    { name: "runLoop", kind: 0x00, index: 0 },
    { name: "primitiveAdd", kind: 0x00, index: 1 },
    { name: "primitiveSub", kind: 0x00, index: 2 },
    { name: "primitiveMul", kind: 0x00, index: 3 },
    { name: "primitiveLessThan", kind: 0x00, index: 4 },
    { name: "primitiveGreaterThan", kind: 0x00, index: 5 },
    { name: "primitiveLessOrEqual", kind: 0x00, index: 6 },
    { name: "primitiveGreaterOrEqual", kind: 0x00, index: 7 },
    { name: "primitiveEqual", kind: 0x00, index: 8 },
    { name: "primitiveNotEqual", kind: 0x00, index: 9 },
    { name: "primitiveCount", kind: 0x00, index: 10 },
  ];
  exportSection.push(...encodeU32(exportEntries.length));
  for (const entry of exportEntries) {
    exportSection.push(...encodeName(entry.name));
    exportSection.push(entry.kind);
    exportSection.push(...encodeU32(entry.index));
  }
  sections.push({ id: 7, data: exportSection });

  const elementSection = [];
  const tableElements = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  elementSection.push(...encodeU32(1));
  elementSection.push(0x00);
  elementSection.push(0x41, 0x00);
  elementSection.push(0x0b);
  elementSection.push(...encodeVector(tableElements.map(index => encodeU32(index))));
  sections.push({ id: 9, data: elementSection });

  const codeSection = [];
  const functionBodies = [];
  functionBodies.push(createRunLoopBody());
  functionBodies.push(createBinaryPrimitiveBody(0x6a)); // add
  functionBodies.push(createBinaryPrimitiveBody(0x6b)); // sub
  functionBodies.push(createBinaryPrimitiveBody(0x6c)); // mul
  functionBodies.push(createBinaryPrimitiveBody(0x48)); // lt_s
  functionBodies.push(createBinaryPrimitiveBody(0x4a)); // gt_s
  functionBodies.push(createBinaryPrimitiveBody(0x4c)); // le_s
  functionBodies.push(createBinaryPrimitiveBody(0x4e)); // ge_s
  functionBodies.push(createBinaryPrimitiveBody(0x46)); // eq
  functionBodies.push(createBinaryPrimitiveBody(0x47)); // ne
  functionBodies.push(createPrimitiveCountBody(9));
  codeSection.push(...encodeU32(functionBodies.length));
  for (const body of functionBodies) {
    codeSection.push(...encodeU32(body.length));
    codeSection.push(...body);
  }
  sections.push({ id: 10, data: codeSection });

  for (const section of sections) {
    bytes.push(section.id);
    bytes.push(...encodeU32(section.data.length));
    bytes.push(...section.data);
  }

  return Uint8Array.from(bytes);
}

function createBinaryPrimitiveBody(opcode) {
  const body = [];
  body.push(...encodeLocals([]));
  encodeInstruction(body, 0x20, 0x00);
  encodeInstruction(body, 0x20, 0x01);
  encodeInstruction(body, opcode);
  encodeInstruction(body, 0x0b);
  return body;
}

function createPrimitiveCountBody(count) {
  const body = [];
  body.push(...encodeLocals([]));
  encodeInstruction(body, 0x41, ...encodeU32(count));
  encodeInstruction(body, 0x0b);
  return body;
}

function createRunLoopBody() {
  const body = [];
  // locals: pc, stackBase, stackTop, limit, opcode, value, lhs, rhs, primIndex
  body.push(...encodeLocals([{ count: 9, type: 0x7f }]));

  const CTX = 0;
  const PC = 1;
  const STACK_BASE = 2;
  const STACK_TOP = 3;
  const LIMIT = 4;
  const OPCODE = 5;
  const VALUE = 6;
  const LHS = 7;
  const RHS = 8;
  const PRIM = 9;

  // load context fields
  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, PC);

  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, STACK_BASE);

  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x41, 0x08);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, STACK_TOP);

  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x41, 0x0c);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, LIMIT);

  // outer block and loop
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x03, 0x40);

  // if limit <= 0 break
  encodeInstruction(body, 0x20, LIMIT);
  encodeInstruction(body, 0x41, 0x00);
  encodeInstruction(body, 0x4e);
  encodeInstruction(body, 0x0d, 0x01);

  // decrement limit
  encodeInstruction(body, 0x20, LIMIT);
  encodeInstruction(body, 0x41, 0x01);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, LIMIT);

  // fetch opcode
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x2d, 0x00, 0x00);
  encodeInstruction(body, 0x21, OPCODE);
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x41, 0x01);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, PC);

  // dispatch blocks
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x02, 0x40);
  encodeInstruction(body, 0x02, 0x40);

  // br_table for opcode dispatch
  encodeInstruction(body, 0x0e, 0x07, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07);

  // case HALT
  encodeInstruction(body, 0x41, 0x00);
  encodeInstruction(body, 0x21, LIMIT);
  encodeInstruction(body, 0x0c, 0x09);
  encodeInstruction(body, 0x0b);

  // case PUSH_INT8
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x2c, 0x00, 0x00);
  encodeInstruction(body, 0x21, VALUE);
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x41, 0x01);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, PC);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x20, VALUE);
  encodeInstruction(body, 0x36, 0x02, 0x00);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x0c, 0x07);
  encodeInstruction(body, 0x0b);

  // case PUSH_INT32
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, VALUE);
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, PC);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x20, VALUE);
  encodeInstruction(body, 0x36, 0x02, 0x00);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x0c, 0x06);
  encodeInstruction(body, 0x0b);

  // helper to guard stack depth for binary ops
  const emitStackGuard = (depth) => {
    encodeInstruction(body, 0x20, STACK_TOP);
    encodeInstruction(body, 0x20, STACK_BASE);
    encodeInstruction(body, 0x6b);
    encodeInstruction(body, 0x41, 0x08);
    encodeInstruction(body, 0x49);
    encodeInstruction(body, 0x0d, depth);
  };

  // case ADD
  emitStackGuard(0x04);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, RHS);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, LHS);
  encodeInstruction(body, 0x20, LHS);
  encodeInstruction(body, 0x20, RHS);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, VALUE);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x20, VALUE);
  encodeInstruction(body, 0x36, 0x02, 0x00);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x0c, 0x05);
  encodeInstruction(body, 0x0b);

  // case SUB
  emitStackGuard(0x03);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, RHS);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, LHS);
  encodeInstruction(body, 0x20, LHS);
  encodeInstruction(body, 0x20, RHS);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, VALUE);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x20, VALUE);
  encodeInstruction(body, 0x36, 0x02, 0x00);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x0c, 0x04);
  encodeInstruction(body, 0x0b);

  // case MUL
  emitStackGuard(0x02);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, RHS);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, LHS);
  encodeInstruction(body, 0x20, LHS);
  encodeInstruction(body, 0x20, RHS);
  encodeInstruction(body, 0x6c);
  encodeInstruction(body, 0x21, VALUE);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x20, VALUE);
  encodeInstruction(body, 0x36, 0x02, 0x00);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x0c, 0x03);
  encodeInstruction(body, 0x0b);

  // case PRIMITIVE_CALL
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x2d, 0x00, 0x00);
  encodeInstruction(body, 0x21, PRIM);
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x41, 0x01);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, PC);
  // guard primitive index < 9
  encodeInstruction(body, 0x20, PRIM);
  encodeInstruction(body, 0x41, 0x09);
  encodeInstruction(body, 0x4d);
  encodeInstruction(body, 0x0d, 0x01);
  emitStackGuard(0x01);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, RHS);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x21, LHS);
  encodeInstruction(body, 0x20, LHS);
  encodeInstruction(body, 0x20, RHS);
  encodeInstruction(body, 0x11, 0x01, 0x00);
  encodeInstruction(body, 0x21, VALUE);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x20, VALUE);
  encodeInstruction(body, 0x36, 0x02, 0x00);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x21, STACK_TOP);
  encodeInstruction(body, 0x0c, 0x02);
  encodeInstruction(body, 0x0b);

  // default block
  encodeInstruction(body, 0x41, 0x00);
  encodeInstruction(body, 0x21, LIMIT);
  encodeInstruction(body, 0x0c, 0x02);
  encodeInstruction(body, 0x0b);

  // end nested blocks and loop
  encodeInstruction(body, 0x0b);
  encodeInstruction(body, 0x0b);

  // store context back
  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x20, PC);
  encodeInstruction(body, 0x36, 0x02, 0x00);

  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x20, STACK_BASE);
  encodeInstruction(body, 0x36, 0x02, 0x00);

  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x41, 0x08);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x36, 0x02, 0x00);

  encodeInstruction(body, 0x20, CTX);
  encodeInstruction(body, 0x41, 0x0c);
  encodeInstruction(body, 0x6a);
  encodeInstruction(body, 0x20, LIMIT);
  encodeInstruction(body, 0x36, 0x02, 0x00);

  // return top stack value or 0 when empty
  encodeInstruction(body, 0x02, 0x7f);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x20, STACK_BASE);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x49);
  encodeInstruction(body, 0x04, 0x40);
  encodeInstruction(body, 0x41, 0x00);
  encodeInstruction(body, 0x0c, 0x01);
  encodeInstruction(body, 0x0b);
  encodeInstruction(body, 0x20, STACK_TOP);
  encodeInstruction(body, 0x41, 0x04);
  encodeInstruction(body, 0x6b);
  encodeInstruction(body, 0x28, 0x02, 0x00);
  encodeInstruction(body, 0x0c, 0x01);
  encodeInstruction(body, 0x0b);

  encodeInstruction(body, 0x0b);
  return body;
}

const binary = createModule();
const hexArray = Array.from(binary, b => `0x${b.toString(16).padStart(2, "0")}`);
let output = "const wasmPrototypeBinary = new Uint8Array([\n    ";
hexArray.forEach((hex, index) => {
  if (index && index % 8 === 0) output += "\n    ";
  output += hex;
  if (index !== hexArray.length - 1) output += ", ";
});
output += "\n]);";
console.log(output);
console.log("module size:", binary.length);
