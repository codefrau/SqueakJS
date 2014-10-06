JS translation
generateCos: msgNode on: aStream indent: level
	"Generate the JS code for the message onto the given stream."

	aStream nextPutAll: 'Math.cos('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ')'.
