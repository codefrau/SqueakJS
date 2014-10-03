translating builtins
generateFieldPut: aNode on: aStream indent: anInteger
		
	aStream nextPutAll: 'interpreterProxy->storePointerofObjectwithValue('.
	self emitJSExpression: aNode args first on: aStream.
	aStream nextPutAll: ','.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ','.
	self emitJSExpression: aNode args second on: aStream.
	aStream nextPutAll: ')'.