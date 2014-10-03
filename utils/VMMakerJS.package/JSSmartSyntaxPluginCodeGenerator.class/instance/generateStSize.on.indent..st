translating builtins
generateStSize: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->stSizeOf('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.