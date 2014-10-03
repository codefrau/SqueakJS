JS translation
generateBetweenAnd: msgNode on: aStream indent: level
	"Generate the JS code for the between:and: message onto the given stream."

	aStream nextPutAll: '(('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ' >= '.
	self emitJSExpression: msgNode args first on: aStream.
	aStream nextPutAll: ') && ('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ' <= '.
	self emitJSExpression: msgNode args second on: aStream.
	aStream nextPutAll: '))'