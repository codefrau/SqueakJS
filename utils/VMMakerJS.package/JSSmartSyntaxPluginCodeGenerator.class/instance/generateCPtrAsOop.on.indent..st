translating builtins
generateCPtrAsOop: aNode on: aStream indent: anInteger 

	aStream nextPutAll: '('.
	aStream nextPutAll: 'oopForPointer( '.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ' ) - BASE_HEADER_SIZE)'