JS code generator
jsLiteralFor: anObject
	"Return a string representing theJS literal value for the given object."
	(anObject isKindOf: Integer) ifTrue: [^ anObject printString].
	(anObject isKindOf: String) ifTrue: [^ '"', anObject, '"' ].
	(anObject isKindOf: Float) ifTrue: [^ anObject printString ].
	anObject == nil ifTrue: [^ 'null' ].
	anObject == true ifTrue: [^ 'true' ].
	anObject == false ifTrue: [^ 'false' ].
	self error:
		'Warning: A Smalltalk literal could not be translated into a JS constant: ', anObject printString.
	^'"XXX UNTRANSLATABLE CONSTANT XXX"'