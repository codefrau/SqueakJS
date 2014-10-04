JS hacks
isOneBasedArray: varName in: method
	^(method isOneBasedArray: varName)
		ifNil: [self oneBasedArrays]
		ifNotNil: [:oneBased | self oneBasedArrays: oneBased]