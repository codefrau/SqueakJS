translating builtins
generateAsCDouble: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->floatValueOf('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.