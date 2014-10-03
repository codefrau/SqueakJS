JS translation
generateAsSymbol: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream.
	 The receiver is expected to be a JSConstantNode."

	aStream nextPutAll: (self cFunctionNameFor: msgNode receiver nameOrValue)