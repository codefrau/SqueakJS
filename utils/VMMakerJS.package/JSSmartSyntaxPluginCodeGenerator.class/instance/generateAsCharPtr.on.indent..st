translating builtins
generateAsCharPtr: aNode on: aStream indent: anInteger

	aStream nextPutAll: '(char *) interpreterProxy->firstIndexableField('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.