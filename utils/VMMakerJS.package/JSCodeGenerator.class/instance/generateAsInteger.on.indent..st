JS translation
generateAsInteger: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	aStream nextPutAll:'('.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: '|0)'