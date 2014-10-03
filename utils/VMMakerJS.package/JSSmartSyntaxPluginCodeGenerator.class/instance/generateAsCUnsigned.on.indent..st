translating builtins
generateAsCUnsigned: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->positive32BitValueOf('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.