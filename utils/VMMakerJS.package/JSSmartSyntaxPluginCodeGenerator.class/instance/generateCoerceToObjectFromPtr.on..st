asOop:/asValue:
generateCoerceToObjectFromPtr: aNode on: aStream
	"This code assumes no named instance variables"
self halt: 'todo'.
	aStream nextPutAll: 'oopForPointer('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: ') - BASE_HEADER_SIZE'