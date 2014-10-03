translating builtins
generateAsIfVarAsValue: aNode on: aStream indent: anInteger

	| cName fName class index fetchNode |
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
	fetchNode := TSendNode new
		setSelector: #fetchPointer:ofObject:
		receiver: (TVariableNode new setName: 'interpreterProxy')
		arguments: (Array
			with: (TConstantNode new setValue: index - 1)
			with: aNode receiver).
	cName := aNode args third nameOrValue.
	class := Smalltalk 
		at: (cName asSymbol) 
		ifAbsent: [nil].
	(class isNil not and: [class isBehavior]) ifFalse: 
		[^self error: 'third arg must identify class'].
	class jscg: self generateCoerceToValueFrom: fetchNode on: aStream
