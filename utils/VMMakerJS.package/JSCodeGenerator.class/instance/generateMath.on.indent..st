JS translation
generateMath: msgNode on: aStream indent: level
	"Generate the JS code for the message onto the given stream."
	aStream nextPutAll: 'Math.'; nextPutAll: msgNode selector; nextPut: $(.
	msgNode receiver emitJSCodeAsExpressionOn: aStream level: 0 generator: self.
	aStream nextPut: $).
