translating builtins
generateIsPointers: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isPointers('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.