JS translation
generatePreDecrement: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| varNode |
	varNode := msgNode receiver.
	varNode isVariable
		ifFalse: [ self error: 'preDecrement can only be applied to variables' ].
	self checkNonPointer: varNode op: '--'.
	aStream nextPutAll: '--'.
	aStream nextPutAll: (self returnPrefixFromVariable: varNode name).
