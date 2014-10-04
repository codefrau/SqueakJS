JS hacks
oneBasedArrays: aBoolean
	oneBasedArrays ifNil: [^oneBasedArrays := aBoolean].
	oneBasedArrays = aBoolean ifFalse: [
		self halt: 'mixed one-based and zero-based array access'].
	^aBoolean