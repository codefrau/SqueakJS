translating builtins
generateAsIfVarPut: aNode on: aStream indent: anInteger

	| cName fName class index |
	cName := String streamContents: 
		[:scStr | self emitJSExpression: aNode args first on: scStr].
	class := Smalltalk 
		at: (cName asSymbol) 
		ifAbsent: [nil].
	(class isNil not and: [class isBehavior]) ifFalse: 
		[^self error: 'first arg must identify class'].
	fName := aNode args second value.
	index := class allInstVarNames
		indexOf: fName
		ifAbsent: [^self error: 'second arg must be instVar'].
	aStream 
		nextPutAll: 'interpreterProxy->storePointerofObjectwithValue(';
		nextPutAll: (index - 1) asString;
		nextPutAll: ','.
	self emitJSExpression: aNode receiver on: aStream.
	aStream nextPutAll: ','.
	self emitJSExpression: aNode args third on: aStream.
	aStream nextPutAll: ')'.