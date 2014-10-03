translating builtins
generateAsBooleanObj: aNode on: aStream indent: anInteger

	aStream nextPutAll: '('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: 
		') ? interpreterProxy->trueObject(): interpreterProxy->falseObject()'.