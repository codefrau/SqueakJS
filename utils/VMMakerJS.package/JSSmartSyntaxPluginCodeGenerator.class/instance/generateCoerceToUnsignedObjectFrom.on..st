asOop:/asValue:
generateCoerceToUnsignedObjectFrom: aNode on: aStream
self halt: 'todo'.
	aStream nextPutAll: 'interpreterProxy.positive32BitIntegerFor('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: ')'