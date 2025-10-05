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

function createModule() {
  const bytes = [];
  bytes.push(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);

  const sections = [];

  const typeSection = [];
  const types = [
    [0x60, ...encodeU32(1), 0x7f, ...encodeU32(1), 0x7f],
    [0x60, ...encodeU32(3), 0x7f, 0x7f, 0x7f, ...encodeU32(1), 0x7f],
    [0x60, ...encodeU32(4), 0x7f, 0x7f, 0x7f, 0x7f, ...encodeU32(1), 0x7f],
  ];
  typeSection.push(...encodeVector(types));
  sections.push({ id: 1, data: typeSection });

  const funcSection = [];
  funcSection.push(...encodeU32(4));
  funcSection.push(...encodeU32(0));
  funcSection.push(...encodeU32(1));
  funcSection.push(...encodeU32(1));
  funcSection.push(...encodeU32(2));
  sections.push({ id: 3, data: funcSection });

  const exports = [];
  const exportEntries = [
    { name: "runLoop", index: 0 },
    { name: "binaryIntOp", index: 1 },
    { name: "binaryCompareOp", index: 2 },
    { name: "binarySeriesOp", index: 3 },
  ];
  exports.push(...encodeU32(exportEntries.length));
  for (const entry of exportEntries) {
    const nameBytes = Array.from(Buffer.from(entry.name, "utf8"));
    exports.push(...encodeU32(nameBytes.length));
    exports.push(...nameBytes);
    exports.push(0x00);
    exports.push(...encodeU32(entry.index));
  }
  sections.push({ id: 7, data: exports });

  const codeSection = [];
  const functionBodies = [];
  functionBodies.push(createRunLoopBody());
  functionBodies.push(createBinaryIntBody());
  functionBodies.push(createBinaryCompareBody());
  functionBodies.push(createBinarySeriesBody());
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

function createRunLoopBody() {
  const body = [];
  body.push(...encodeU32(1));
  body.push(...encodeU32(2));
  body.push(0x7f);
  body.push(0x41, 0x00);
  body.push(0x21, 0x01);
  body.push(0x41, 0x00);
  body.push(0x21, 0x02);
  body.push(0x02, 0x40);
  body.push(0x03, 0x40);
  body.push(0x20, 0x01);
  body.push(0x20, 0x00);
  body.push(0x4f);
  body.push(0x0d, 0x01);
  body.push(0x20, 0x02);
  body.push(0x20, 0x01);
  body.push(0x41, 0xff, 0x01);
  body.push(0x71);
  body.push(0x6a);
  body.push(0x20, 0x02);
  body.push(0x41, 0x01);
  body.push(0x74);
  body.push(0x73);
  body.push(0x21, 0x02);
  body.push(0x20, 0x01);
  body.push(0x41, 0x01);
  body.push(0x6a);
  body.push(0x21, 0x01);
  body.push(0x0c, 0x00);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x20, 0x02);
  body.push(0x0b);
  return body;
}

function createBinaryIntBody() {
  const body = [];
  body.push(...encodeU32(0));
  body.push(0x20, 0x00);
  body.push(0x41, 0x00);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x6a);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x01);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x6b);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x02);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x6c);
  body.push(0x05);
  body.push(0x41, 0x00);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  return body;
}

function createBinaryCompareBody() {
  const body = [];
  body.push(...encodeU32(0));
  body.push(0x20, 0x00);
  body.push(0x41, 0x00);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x48);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x01);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x4a);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x02);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x4c);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x03);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x4e);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x04);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x46);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x05);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x01);
  body.push(0x20, 0x02);
  body.push(0x47);
  body.push(0x05);
  body.push(0x41, 0x00);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  return body;
}

function createBinarySeriesBody() {
  const body = [];
  body.push(...encodeU32(1));
  body.push(...encodeU32(5));
  body.push(0x7f);
  body.push(0x41, 0x00);
  body.push(0x21, 0x04);
  body.push(0x41, 0x00);
  body.push(0x21, 0x05);
  body.push(0x02, 0x40);
  body.push(0x03, 0x40);
  body.push(0x20, 0x04);
  body.push(0x20, 0x03);
  body.push(0x4f);
  body.push(0x0d, 0x01);
  body.push(0x20, 0x01);
  body.push(0x20, 0x04);
  body.push(0x6a);
  body.push(0x21, 0x06);
  body.push(0x20, 0x02);
  body.push(0x20, 0x04);
  body.push(0x6a);
  body.push(0x21, 0x07);
  body.push(0x20, 0x00);
  body.push(0x41, 0x00);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x06);
  body.push(0x20, 0x07);
  body.push(0x6a);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x01);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x06);
  body.push(0x20, 0x07);
  body.push(0x6b);
  body.push(0x05);
  body.push(0x20, 0x00);
  body.push(0x41, 0x02);
  body.push(0x46);
  body.push(0x04, 0x7f);
  body.push(0x20, 0x06);
  body.push(0x20, 0x07);
  body.push(0x6c);
  body.push(0x05);
  body.push(0x41, 0x00);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x21, 0x08);
  body.push(0x20, 0x05);
  body.push(0x20, 0x08);
  body.push(0x73);
  body.push(0x21, 0x05);
  body.push(0x20, 0x04);
  body.push(0x41, 0x01);
  body.push(0x6a);
  body.push(0x21, 0x04);
  body.push(0x0c, 0x00);
  body.push(0x0b);
  body.push(0x0b);
  body.push(0x20, 0x05);
  body.push(0x0b);
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
