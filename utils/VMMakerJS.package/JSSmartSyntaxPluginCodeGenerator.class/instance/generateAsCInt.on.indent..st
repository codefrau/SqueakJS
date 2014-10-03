translating builtins
generateAsCInt: aNode on: aStream indent: anInteger

	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ' >> 1'.