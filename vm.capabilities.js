"use strict";

import { isDeterministicModeEnabled, getDeterministicSummary } from "./vm.execution.deterministic.js";

/**
 * Evaluate interpreter/image characteristics and compute the capability
 * negotiation plan. The returned structure contains the set of patches that are
 * required for compatibility, optional accelerators that depend on runtime
 * configuration, and any diagnostics useful for logging.
 *
 * @param {object} vm
 * @returns {{
 *   requiredPatches: CapabilityPatch[],
 *   optionalPatches: CapabilityPatch[],
 *   capabilities: Record<string, boolean>,
 *   diagnostics: string[]
 * }}
 */
export function negotiateInterpreterCapabilities(vm) {
  const negotiation = {
    requiredPatches: [],
    optionalPatches: [],
    capabilities: {},
    diagnostics: []
  };

  if (!vm || !vm.image) {
    negotiation.diagnostics.push("capabilities: missing vm or image context");
    return negotiation;
  }

  const options = vm.options || {};
  const sista = Boolean(vm.method && typeof vm.method.methodSignFlag === "function" && vm.method.methodSignFlag());
  const isSpur = Boolean(vm.image && vm.image.isSpur);

  negotiation.diagnostics.push(`capabilities: backend=${sista ? "sista" : "stack"}, spur=${isSpur}`);

  negotiation.requiredPatches.push(createWordSizePatch(vm));
  negotiation.capabilities.wordSizeNormalized = true;

  negotiation.requiredPatches.push(createLatin1Patch(vm, { sista, isSpur }));
  negotiation.capabilities.transcodingNormalized = true;

  if (options.wizard === false) {
    const patch = createReleaseBuilderWizardPatch(vm, { sista });
    if (patch) {
      negotiation.optionalPatches.push(patch);
      negotiation.capabilities.releaseBuilderWizardSuppressed = true;
    }
  }

  if (sista && options.wizard === false) {
    const patch = createReleaseBuilderWizardClosurePatch(vm);
    if (patch) {
      negotiation.optionalPatches.push(patch);
      negotiation.capabilities.releaseBuilderWizardSuppressed = true;
    }
  }

  if (sista && options.welcome === false) {
    const patch = createReleaseBuilderWelcomePatch(vm);
    if (patch) {
      negotiation.optionalPatches.push(patch);
      negotiation.capabilities.releaseBuilderWelcomeSuppressed = true;
    }
  }

  if (sista) {
    negotiation.optionalPatches.push(createFfiAbiPatch(vm));
    negotiation.capabilities.ffiAbiShim = true;
  }

  if (isDeterministicModeEnabled(vm)) {
    const summary = getDeterministicSummary(vm);
    if (summary) {
      negotiation.capabilities.deterministicMode = {
        clockStep: summary.clock.step,
        networkBlocked: summary.network.blocked,
        randomSeed: summary.random.seed
      };
      negotiation.diagnostics.push(
        `capabilities: deterministic mode enabled (step=${summary.clock.step}, networkBlocked=${summary.network.blocked ? "yes" : "no"})`
      );
    }
  }

  return negotiation;
}

/**
 * @typedef {Object} CapabilityPatch
 * @property {string} id
 * @property {string} method
 * @property {{pc?: number, closure?: number, old: number, hack: number}=} bytecode
 * @property {{index: number, old?: number, hack?: number, skip?: any, old_str?: string, new_str?: string}=} literal
 * @property {number=} primitive
 * @property {string=} capability
 * @property {string=} description
 */

function createWordSizePatch(vm) {
  return {
    id: "smalltalkImageWordSizeLiteral",
    method: "SmalltalkImage>>wordSize",
    literal: { index: 1, old: 8, hack: 4, skip: vm.nilObj },
    capability: "wordSizeNormalized",
    description: "Ensure cross-platform word size reporting"
  };
}

function createLatin1Patch(vm, { sista, isSpur }) {
  if (!isSpur) {
    return {
      id: "latin1SystemConverterLegacy",
      method: "Latin1Environment class>>systemConverterClass",
      bytecode: { pc: 53, old: 0x45, hack: 0x49 },
      capability: "latin1TranscodingOverride",
      description: "Force UTF-8 converter on legacy images"
    };
  }
  if (sista) {
    return {
      id: "latin1SystemConverterSpurSista",
      method: "Latin1Environment class>>systemConverterClass",
      bytecode: { pc: 38, old: 0x16, hack: 0x13 },
      capability: "latin1TranscodingOverride",
      description: "Select UTF-8 converter on Spur Sista images"
    };
  }
  return {
    id: "latin1SystemConverterSpur",
    method: "Latin1Environment class>>systemConverterClass",
    bytecode: { pc: 50, old: 0x44, hack: 0x48 },
    capability: "latin1TranscodingOverride",
    description: "Select UTF-8 converter on Spur images"
  };
}

function createReleaseBuilderWizardPatch(_vm, { sista }) {
  if (sista) return null;
  return {
    id: "releaseBuilderWizardLegacy",
    method: "ReleaseBuilder class>>prepareEnvironment",
    bytecode: { pc: 28, old: 0xD8, hack: 0x87 },
    capability: "releaseBuilderWizardSuppressed",
    description: "Disable welcome wizard for legacy images"
  };
}

function createReleaseBuilderWizardClosurePatch(_vm) {
  return {
    id: "releaseBuilderWizardSista",
    method: "ReleaseBuilder class>>prepareEnvironment",
    bytecode: { closure: 9, pc: 5, old: 0x81, hack: 0xD8 },
    capability: "releaseBuilderWizardSuppressed",
    description: "Disable wizard send within closure for Sista images"
  };
}

function createReleaseBuilderWelcomePatch(_vm) {
  return {
    id: "releaseBuilderWelcomeSista",
    method: "ReleaseBuilder class>>prepareEnvironment",
    bytecode: { closure: 9, pc: 2, old: 0x90, hack: 0xD8 },
    capability: "releaseBuilderWelcomeSuppressed",
    description: "Disable welcome workspace for Sista images"
  };
}

function createFfiAbiPatch(_vm) {
  return {
    id: "ffiAbi32Shim",
    method: "FFIPlatformDescription>>abi",
    literal: { index: 21, old_str: "UNKNOWN_ABI", new_str: "IA32" },
    capability: "ffiAbiShim",
    description: "Report IA32 ABI for new FFI when platform detection fails"
  };
}
