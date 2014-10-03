composition
addClass: aClass selectorPrefix: prefix
	"Incorporate the methods of aClass, and rename with prefixes reflecting the
	variable name. This is a simple transformation intended to support MemoryAccess,
	with renaming to avoid conflict with standard sqMemoryAccess.h macros."

	self addClass: aClass.
	aClass selectors do: [:sel |
		self renameSelector: sel
			as: (prefix, '_', sel) asSymbol].
