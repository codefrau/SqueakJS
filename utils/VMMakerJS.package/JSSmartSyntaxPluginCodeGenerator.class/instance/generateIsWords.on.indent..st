translating builtins
generateIsWords: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isWords('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.