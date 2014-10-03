translating builtins
generateIsWordsOrBytes: aNode on: aStream indent: anInteger

	aStream nextPutAll: 'interpreterProxy->isWordsOrBytes('.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ')'.