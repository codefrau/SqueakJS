asOop:/asValue:
generateCoerceToBooleanValueFrom: aNode on: aStream
self halt: 'todo'.
	aStream nextPutAll: 'interpreterProxy.booleanValueOf('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: ')'