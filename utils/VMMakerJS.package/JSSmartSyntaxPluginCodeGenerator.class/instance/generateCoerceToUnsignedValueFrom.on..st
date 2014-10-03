asOop:/asValue:
generateCoerceToUnsignedValueFrom: aNode on: aStream
self halt: 'todo'.
	aStream nextPutAll: 'interpreterProxy.positive32BitValueOf('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: ')'