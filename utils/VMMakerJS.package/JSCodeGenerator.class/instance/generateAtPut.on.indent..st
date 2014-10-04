JS translation
generateAtPut: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	self generateAt: msgNode on: aStream indent: level.
	aStream nextPutAll: ' = '.
	self emitJSExpression: msgNode args last on: aStream