translating builtins
generateNext: msgNode on: aStream indent: level
	"Generate the C code for this message onto the given stream."

	| varNode |
	varNode := msgNode receiver.
	varNode isVariable
		ifFalse: [ self error: 'next can only be applied to variables' ].
	aStream nextPutAll: '*'.
	aStream nextPutAll: varNode name.
	aStream nextPutAll: '++'
