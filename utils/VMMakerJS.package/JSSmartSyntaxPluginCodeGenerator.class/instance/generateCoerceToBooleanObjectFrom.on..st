asOop:/asValue:
generateCoerceToBooleanObjectFrom: aNode on: aStream

	aStream nextPutAll: '('.
	self emitJSExpression: aNode on: aStream.
	aStream nextPutAll: '? interpreterProxy.trueObject() : interpreterProxy.falseObject())'