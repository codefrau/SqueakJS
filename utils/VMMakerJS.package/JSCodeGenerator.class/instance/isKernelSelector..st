utilities
isKernelSelector: sel
	"Answer true if the given selector is one of the kernel selectors that are implemented as macros."

	^(#(error:
		 oopAt: oopAt:put: oopAtPointer: oopAtPointer:put:
		 byteAt: byteAt:put: byteAtPointer: byteAtPointer:put:
		 shortAt: shortAt:put: shortAtPointer: shortAtPointer:put:
		 intAt: intAt:put: intAtPointer: intAtPointer:put:
		 longAt: longAt:put: longAtPointer: longAtPointer:put:
		 longLongAt: longLongAt:put: longLongAtPointer: longLongAtPointer:put:
		 fetchFloatAt:into: storeFloatAt:from:
				fetchFloatAtPointer:into: storeFloatAtPointer:from:
		 fetchSingleFloatAt:into: storeSingleFloatAt:from:
				fetchSingleFloatAtPointer:into: storeSingleFloatAtPointer:from:
		 pointerForOop: oopForPointer:
		 cCoerce:to: cCoerceSimple:to:)
			includes: sel)