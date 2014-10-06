utilities
returnPrefixFromVariable: aName
	aName = 'class'
		ifTrue: [^'sq_class'].
	aName = 'in'
		ifTrue: [^'in_'].
	^aName