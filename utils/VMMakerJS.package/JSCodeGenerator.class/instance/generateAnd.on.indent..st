JS translation
generateAnd: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ' && '.
	self emitJSExpression: msgNode args first on: aStream.