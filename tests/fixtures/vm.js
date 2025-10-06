export function createCapabilityNegotiationVM({ sista = false, isSpur = false, options = {} } = {}) {
  const nilObj = { __nil: true };
  return {
    image: {
      isSpur
    },
    options,
    nilObj,
    method: {
      methodSignFlag: () => (sista ? 1 : 0)
    },
    primHandler: {
      makeStString: (str) => ({
        bytesAsString: () => str,
        value: str
      })
    }
  };
}

export const MB = 1_000_000;

export function createMemorySnapshot({
  headroomMB,
  freeMB,
  youngMB,
  newMB,
  hostUsedMB,
  hostLimitMB,
  oldSpaceMB = 140,
  lowSpaceMB = 2
}) {
  return {
    policy: {
      headroomBytes: Math.round(headroomMB * MB),
      lowSpaceBytes: Math.round(lowSpaceMB * MB)
    },
    freeBytes: Math.round(freeMB * MB),
    youngAllocatedBytes: Math.round((youngMB + newMB) * MB),
    headroomBytes: Math.round(headroomMB * MB),
    oldSpaceBytes: Math.round(oldSpaceMB * MB),
    host: {
      usedJSHeapSize: Math.round(hostUsedMB * MB),
      jsHeapSizeLimit: Math.round(hostLimitMB * MB)
    }
  };
}
