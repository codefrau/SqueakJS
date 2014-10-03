JS translation
generateAddressOf: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
self halt.
	aStream nextPut: $(; nextPut: $&.
	self emitJSExpression: msgNode args first on: aStream.
	aStream nextPut: $)