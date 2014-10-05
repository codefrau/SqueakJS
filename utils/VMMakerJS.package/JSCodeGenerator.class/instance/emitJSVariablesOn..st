JS code generator
emitJSVariablesOn: aStream 
	"Store the global variable declarations on the given stream."
	aStream nextPutAll: '/*** Variables ***/'; cr.
	variables asSortedCollection
		do: [:var | 	| varString varDecl |
			varString := var asString.
			aStream nextPutAll: 'var ', varString.
			varDecl := variableDeclarations at: varString ifAbsent: [''].
			(varDecl includes: $=)
				ifTrue: [aStream nextPutAll: ' =', (varDecl copyAfter: $=)]
				ifFalse: [(varDecl includes: $*)
					ifTrue: [aStream nextPutAll: ' = null']
					ifFalse: [aStream nextPutAll: ' = 0']].
			aStream nextPutAll: ';'; cr].
	aStream cr.
