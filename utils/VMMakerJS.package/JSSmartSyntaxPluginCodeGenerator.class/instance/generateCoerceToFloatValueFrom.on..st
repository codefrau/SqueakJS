asOop:/asValue:
generateCoerceToFloatValueFrom: aNode on: aStream
self halt: 'todo'.
	aStream nextPutAll: 'interpreterProxy.floatValueOf('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: ')'