asOop:/asValue:
generateCoerceToPtr: aString fromObject: aNode on: aStream
	"This code assumes no named instance variables"
self halt: 'todo'.
	aStream 
		nextPutAll: '((';
		nextPutAll: aString;
		nextPutAll: ') interpreterProxy->firstIndexableField('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: '))'