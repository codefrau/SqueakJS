JS translation
generatePlus: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	msgNode receiver isBitBltPtr ifFalse: [
		self checkNonPointer: msgNode receiver op: '+'.
		self checkNonPointer: msgNode args first op: '+'.
		self emitJSExpression: msgNode receiver on: aStream.
		aStream nextPutAll: ' + '].
	self emitJSExpression: msgNode args first on: aStream.