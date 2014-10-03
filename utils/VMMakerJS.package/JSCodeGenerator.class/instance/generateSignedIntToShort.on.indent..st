JS translation
generateSignedIntToShort: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
self halt.
	aStream nextPutAll: '((usqInt) (short)'.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPut: $)

