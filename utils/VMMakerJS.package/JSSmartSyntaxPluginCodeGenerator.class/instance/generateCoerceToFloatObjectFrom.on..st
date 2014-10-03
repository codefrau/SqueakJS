asOop:/asValue:
generateCoerceToFloatObjectFrom: aNode on: aStream
self halt: 'todo'.
	aStream nextPutAll: 'interpreterProxy.floatObjectOf('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: ')'