utilities
returnPrefixFromVariable: aName
	aName = 'class'
		ifTrue: [^'sq_class'].
	^aName