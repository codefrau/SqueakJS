JS translation
generateMin: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	aStream nextPutAll: 'Math.min('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ', '.
	self emitJSExpression: msgNode args first on: aStream.
	aStream nextPutAll: ')'.
