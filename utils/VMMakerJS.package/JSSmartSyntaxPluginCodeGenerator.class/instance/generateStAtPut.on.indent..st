translating builtins
generateStAtPut: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy.stObjectatput('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ','.
	self emitJSExpression: aNode args first on: aStream.
	aStream nextPutAll: ','.
	self emitJSExpression: aNode args second on: aStream.
	aStream nextPutAll: ')'
