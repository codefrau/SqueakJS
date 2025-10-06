import test from "node:test";
import assert from "node:assert/strict";
import { negotiateInterpreterCapabilities } from "../../vm.capabilities.js";
import { createCapabilityNegotiationVM } from "../fixtures/vm.js";

test("categorizes required patches for legacy images", () => {
  const vm = createCapabilityNegotiationVM({ sista: false, isSpur: false });
  const negotiation = negotiateInterpreterCapabilities(vm);
  const requiredIds = negotiation.requiredPatches.map((patch) => patch.id).sort();
  assert.deepStrictEqual(requiredIds, [
    "latin1SystemConverterLegacy",
    "smalltalkImageWordSizeLiteral"
  ]);
});

test("selects spur variants for modern images", () => {
  const vm = createCapabilityNegotiationVM({ sista: false, isSpur: true });
  const negotiation = negotiateInterpreterCapabilities(vm);
  const requiredIds = negotiation.requiredPatches.map((patch) => patch.id).sort();
  assert.deepStrictEqual(requiredIds, [
    "latin1SystemConverterSpur",
    "smalltalkImageWordSizeLiteral"
  ]);
});

test("adds sista optional capabilities", () => {
  const vm = createCapabilityNegotiationVM({ sista: true, isSpur: true, options: { wizard: false, welcome: false } });
  const negotiation = negotiateInterpreterCapabilities(vm);
  const optionalIds = negotiation.optionalPatches.map((patch) => patch.id).sort();
  assert.deepStrictEqual(optionalIds, [
    "ffiAbi32Shim",
    "releaseBuilderWelcomeSista",
    "releaseBuilderWizardSista"
  ]);
});

test("includes legacy wizard suppression when requested", () => {
  const vm = createCapabilityNegotiationVM({ sista: false, isSpur: true, options: { wizard: false } });
  const negotiation = negotiateInterpreterCapabilities(vm);
  const optionalIds = negotiation.optionalPatches.map((patch) => patch.id);
  assert.ok(optionalIds.includes("releaseBuilderWizardLegacy"));
});
