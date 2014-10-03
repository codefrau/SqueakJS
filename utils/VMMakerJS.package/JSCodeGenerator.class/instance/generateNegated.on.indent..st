JS translation
generateNegated: msgNode on: aStream indent: level
	"Generate the JS code for the negated message onto the given stream."

	"-0 is a float, 0 - 0 an integer"
	aStream nextPutAll: '(0 - '.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ')'.
