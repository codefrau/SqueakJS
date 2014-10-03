JS translation
generateIntegerObjectOf: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	self emitJSExpression: msgNode args first on: aStream.
