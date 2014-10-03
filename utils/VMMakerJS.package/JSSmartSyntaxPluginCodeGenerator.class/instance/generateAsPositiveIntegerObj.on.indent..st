translating builtins
generateAsPositiveIntegerObj: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->positive32BitIntegerFor('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.