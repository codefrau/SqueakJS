JS translation
generateAbs: msgNode on: aStream indent: level
	"Generate the JS code for the negated message onto the given stream."

	aStream nextPutAll: 'Math.abs('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ')'.
