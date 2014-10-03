public
exportedPrimitiveNames
	"Return an array of all exported primitives"
	^methods select:[:m| m export] thenCollect:[:m| m selectorForCodeGeneration copyWithout: $:].
