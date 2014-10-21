*vmmakerjs
isFloatIn: aCodeGen
	selector precedence = 2 ifFalse: [^false].
	^ (receiver isFloatIn: aCodeGen)
		or: [arguments first isFloatIn: aCodeGen]