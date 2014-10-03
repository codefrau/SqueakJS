translating builtins
generateIsIntegerOop: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isIntegerObject('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.