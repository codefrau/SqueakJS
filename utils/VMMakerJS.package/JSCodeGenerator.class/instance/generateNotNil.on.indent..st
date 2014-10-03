JS translation
generateNotNil: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ' !== '.
	aStream nextPutAll: (self cLiteralFor: nil).