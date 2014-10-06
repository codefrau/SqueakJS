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
				ifTrue: [ | const |
					const := ((varDecl copyAfter: $=) replaceAll: ${ with: $[) replaceAll: $} with: $].
					aStream nextPutAll: ' =', const]
				ifFalse: [(varDecl includesAnyOf: '*[')
					ifTrue: [(varDecl includes: $[)
						ifTrue: [ | size |
							size := (varDecl copyAfter: $[) copyUpTo: $].
							size ifEmpty: [self halt].
							aStream nextPutAll: ' = new Array(', size, ')']
						ifFalse: [aStream nextPutAll: ' = null']]
					ifFalse: [aStream nextPutAll: ' = 0']].
			aStream nextPutAll: ';'; cr].
	aStream cr.
