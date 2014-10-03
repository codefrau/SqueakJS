translating builtins
generateAsSmallIntegerObj: aNode on: aStream indent: anInteger
	self emitJSExpression: aNode receiver on: aStream.
