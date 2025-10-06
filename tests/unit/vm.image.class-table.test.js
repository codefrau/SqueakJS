import test from "node:test";
import assert from "node:assert/strict";

if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis;
}

await import("../../globals.js");
await import("../../vm.js");
await import("../../vm.object.js");
await import("../../vm.object.spur.js");
await import("../../vm.image.js");

test("spurClassTable tolerates missing entries", () => {
  const image = new Squeak.Image("test.image");
  image.headerAudit.reset("test.image");

  const nilObject = new Squeak.ObjectSpur();
  nilObject.oop = 0;
  image.firstOldObject = nilObject;

  const validClass = new Squeak.ObjectSpur();
  validClass.oop = 0x2000;
  validClass.hash = 0x345;

  const classPageObject = new Squeak.ObjectSpur();
  classPageObject.oop = 0x1000;

  const classPageBits = new Uint32Array(1024);
  classPageBits[1] = 0x123456; // missing entry
  classPageBits[2] = validClass.oop;

  const classPages = new Uint32Array(4096);
  classPages[0] = classPageObject.oop;

  const specialObjects = new Squeak.ObjectSpur();
  specialObjects.oop = 0x3000;

  const oopMap = new Map();
  oopMap.set(nilObject.oop, nilObject);
  oopMap.set(validClass.oop, validClass);
  oopMap.set(classPageObject.oop, classPageObject);
  oopMap.set(specialObjects.oop, specialObjects);

  const rawBits = new Map();
  rawBits.set(classPageObject.oop, classPageBits);
  rawBits.set(specialObjects.oop, new Uint32Array(64));

  const classes = image.spurClassTable(oopMap, rawBits, classPages, specialObjects);

  assert.strictEqual(classes[2], validClass, "valid class entries should be retained");
  const issueCodes = image.headerAudit.issues.map((issue) => issue.code);
  assert.ok(issueCodes.includes("class-table-entry-missing"), "missing class entries should be recorded as issues");
});
