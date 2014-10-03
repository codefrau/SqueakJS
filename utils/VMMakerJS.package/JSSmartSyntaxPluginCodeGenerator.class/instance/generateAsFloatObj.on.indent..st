translating builtins
generateAsFloatObj: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->floatObjectOf('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.