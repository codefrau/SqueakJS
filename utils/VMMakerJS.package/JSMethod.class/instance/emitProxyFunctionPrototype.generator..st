JS code generation
emitProxyFunctionPrototype: aStream generator: aCodeGen
	"Emit an indirect C function header for this method onto the given stream."

	| arg |
	aStream nextPutAll: returnType; space.
	aStream nextPutAll: '(*', (aCodeGen jsFunctionNameFor: self selectorForCodeGeneration), ')('.
	args isEmpty ifTrue: [ aStream nextPutAll: 'void' ].
	1 to: args size do: [ :i |
		arg := args at: i.
		(declarations includesKey: arg) ifTrue: [
			aStream nextPutAll: (declarations at: arg).
		] ifFalse: [
			aStream nextPutAll: 'sqInt ', (args at: i).
		].
		i < args size ifTrue: [ aStream nextPutAll: ', ' ].
	].
	aStream nextPutAll: ')'.