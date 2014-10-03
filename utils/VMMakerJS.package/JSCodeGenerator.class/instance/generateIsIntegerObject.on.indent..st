JS translation
generateIsIntegerObject: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	aStream nextPutAll: 'typeof '.
	self emitJSExpression: msgNode args first on: aStream.
	aStream nextPutAll: ' === "number"'.