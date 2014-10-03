translating builtins
generateAsIntPtr: aNode on: aStream indent: anInteger

	aStream nextPutAll: '(int *) interpreterProxy->firstIndexableField('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.