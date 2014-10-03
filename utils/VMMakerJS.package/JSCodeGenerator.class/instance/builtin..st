utilities
builtin: sel 
	"Answer true if the given selector is one of the builtin selectors."
	^ sel = #error:
		or: [(self memoryAccessSelectors includes: sel)
				or: [translationDict includesKey: sel]]