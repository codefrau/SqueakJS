translating builtins
generateIsIndexable: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isIndexable('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.