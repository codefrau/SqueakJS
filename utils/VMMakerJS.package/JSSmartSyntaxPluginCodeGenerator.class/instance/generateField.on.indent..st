translating builtins
generateField: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->fetchPointerofObject('.
	self emitJSExpression: aNode args first on: aStream.
	aStream nextPutAll: ','.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.