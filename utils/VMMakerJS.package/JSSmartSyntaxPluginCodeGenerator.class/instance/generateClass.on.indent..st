translating builtins
generateClass: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->fetchClassOf('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.