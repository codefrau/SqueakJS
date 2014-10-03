translating builtins
generateIsFloat: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isFloatObject('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.