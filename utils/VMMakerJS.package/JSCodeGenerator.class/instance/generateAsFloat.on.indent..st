JS translation
generateAsFloat: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
self halt.
	aStream nextPutAll:'((double) '.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ' )'.