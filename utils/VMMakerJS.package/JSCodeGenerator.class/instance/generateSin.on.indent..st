JS translation
generateSin: msgNode on: aStream indent: level
	"Generate the JS code for the message onto the given stream."

	aStream nextPutAll: 'Math.sin('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ')'.
