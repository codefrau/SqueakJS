translating builtins
generateIsBytes: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isBytes('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.