transformations
renameSelector: selectorName as: newSelectorName
	"Rename selectors such that generated code will use the newSelectorName. This
	is intended to allow methods that may have default implementations in the support
	code to be renamed for code generation, such that the renamed versions will
	be referenced rather than the default platform implementations. For example,
	if #pointerForOop: is implemented in Smalltalk, it may be renamed such that
	the generated pointerForOop() function will be renamed to avoid conflict with
	the standard definitions provided in sqMemoryAccess.h."

	selector = selectorName
		ifTrue: [selector := newSelectorName].
	parseTree nodesDo: [:node |
			node
				renameSelector: selectorName
				as: newSelectorName ]
