JS translation
generateInlineCppIfDef: msgNode on: aStream indent: level
	"Generate the C code for this message onto the given stream."

	aStream nextPutAll: '// skipping ifdef ', msgNode args first value