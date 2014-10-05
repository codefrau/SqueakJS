utilities
isBuiltinSelector: sel
	"Answer true if the given selector is one of the builtin selectors."

	^(self isKernelSelector: sel) or: [translationDict includesKey: sel]