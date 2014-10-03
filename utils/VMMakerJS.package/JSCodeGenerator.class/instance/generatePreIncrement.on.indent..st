JS translation
generatePreIncrement: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| varNode |
	varNode := msgNode receiver.
	varNode isVariable
		ifFalse: [ self error: 'preIncrement can only be applied to variables' ].
	aStream nextPutAll: '++'.
	self checkNonPointer: varNode op: '++'.
	aStream nextPutAll: (self returnPrefixFromVariable: varNode name).
