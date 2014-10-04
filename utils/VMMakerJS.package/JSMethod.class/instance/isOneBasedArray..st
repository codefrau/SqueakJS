JS code generation
isOneBasedArray: varName
	^oneBasedArrays ifNotNil: [oneBasedArrays includes: varName].
