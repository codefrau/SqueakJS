JS translation
generateAt: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPut: $[.
	msgNode args first emitJSCodeAsExpressionOn: aStream level: level + 1 generator: self.
	aStream nextPut: $]