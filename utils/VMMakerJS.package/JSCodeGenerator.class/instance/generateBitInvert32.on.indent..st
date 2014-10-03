JS translation
generateBitInvert32: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	aStream nextPut: $~.
	self emitJSExpression: msgNode receiver on: aStream