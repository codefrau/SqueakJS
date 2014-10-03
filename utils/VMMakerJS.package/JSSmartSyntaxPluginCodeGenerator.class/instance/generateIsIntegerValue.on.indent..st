translating builtins
generateIsIntegerValue: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isIntegerValue('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.