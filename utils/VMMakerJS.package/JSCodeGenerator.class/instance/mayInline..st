inlining
mayInline: sel
	"Answer true if the method with the given selector may be inlined."

	^ inlineList includes: sel