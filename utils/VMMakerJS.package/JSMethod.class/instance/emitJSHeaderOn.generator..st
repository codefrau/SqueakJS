JS code generation
emitJSHeaderOn: aStream generator: aCodeGen
	"Emit a C function header for this method onto the given stream."

	aStream cr. 
	self emitJSFunctionHeader: aStream generator: aCodeGen.
	aStream nextPutAll: ' {'; cr.
	self emitGlobalStructReferenceOn: aStream.
	locals do: [ :var | | varDecl |
		aStream nextPutAll: '	var ', (aCodeGen returnPrefixFromVariable: var).
		varDecl := declarations at: var asString ifAbsent: [''].
		(varDecl includes: $=)
			ifTrue: [ | const |
				const := ((varDecl copyAfter: $=) replaceAll: ${ with: $[) replaceAll: $} with: $].
				aStream nextPutAll: ' =', const]
			ifFalse: [(varDecl includes: $[)
					ifTrue: [ | size |
						size := (varDecl copyAfter: $[) copyUpTo: $].
						size ifEmpty: [self halt].
						aStream nextPutAll: ' = new Array(', size, ')']].
		aStream nextPutAll: ';'; cr
	].
	locals isEmpty ifFalse: [ aStream cr ].