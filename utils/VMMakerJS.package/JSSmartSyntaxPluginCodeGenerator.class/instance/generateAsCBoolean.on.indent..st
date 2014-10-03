translating builtins
generateAsCBoolean: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->booleanValueOf('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.