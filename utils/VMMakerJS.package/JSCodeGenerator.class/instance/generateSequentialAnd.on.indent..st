JS translation
generateSequentialAnd: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ' && ('.
	self emitJSTestBlock: msgNode args first on: aStream.
	aStream nextPut: $)