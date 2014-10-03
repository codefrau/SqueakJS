translating builtins
generateStAt: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->stObjectat('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ','.
	self emitJSExpression: aNode args first on: aStream.
	aStream nextPutAll: ')'
