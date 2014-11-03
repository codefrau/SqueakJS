JS translation
generateMath: msgNode on: aStream indent: level
	"Generate the JS code for the message onto the given stream."
	aStream nextPutAll: 'Math.'; nextPutAll: msgNode selector; nextPut: $(.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPut: $).
