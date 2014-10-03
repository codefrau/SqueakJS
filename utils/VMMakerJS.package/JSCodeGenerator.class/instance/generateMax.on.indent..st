JS translation
generateMax: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	aStream nextPutAll: 'Math.max('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ', '.
	self emitJSExpression: msgNode args first on: aStream.
	aStream nextPutAll: ')'.
