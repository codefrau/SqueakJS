specifying primitives
primitive: aString parameters: anArray receiver: aClassSymbol

	self selectorOverride: aString asSymbol.
	anArray size == args size ifFalse: 
		[^self error: self selectorOverride, ': incorrect number of parameter specifications'].
	parmSpecs := anArray collect:
		[:each | Smalltalk at: each ifAbsent:
			[^self error: self selectorOverride, ': parameter spec must be a Behavior']].
	parmSpecs do: [:each | each isBehavior ifFalse:
		[^self error: self selectorOverride, ': parameter spec must be a Behavior']].
	rcvrSpec := Smalltalk at: aClassSymbol asSymbol ifAbsent:
		[^self error: self selectorOverride, ': receiver spec must be a Behavior'].
	rcvrSpec isBehavior ifFalse:
		[^self error: self selectorOverride, ': receiver spec must be a Behavior'].
	^true