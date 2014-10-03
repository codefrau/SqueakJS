translating builtins
generateAsOop: aNode on: aStream indent: anInteger

	| cName class |
	cName := aNode args first nameOrValue.
	class := Smalltalk 
		at: (cName asSymbol) 
		ifAbsent: [nil].
	(class isNil not and: [class isBehavior]) ifFalse: 
		[^self error: 'first arg must identify class'].
	class jscg: self generateCoerceToOopFrom: aNode receiver on: aStream