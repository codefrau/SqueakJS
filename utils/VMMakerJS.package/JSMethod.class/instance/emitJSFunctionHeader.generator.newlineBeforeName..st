JS code generation
emitJSFunctionHeader: aStream generator: aCodeGen newlineBeforeName: newlineBeforeName "<Boolean>"
	"Emit a JS function header for this method onto the given stream."

	aStream nextPutAll: 'function'.
	newlineBeforeName ifTrue: [aStream cr] ifFalse: [aStream space].
	(returnType last = $)
	and: [returnType includesSubString: (aCodeGen jsFunctionNameFor: self selectorForCodeGeneration)]) ifTrue:
		["Hack fix for e.g. <returnTypeC: 'void (*setInterruptCheckChain(void (*aFunction)(void)))()'>"
		 ^self].
	aStream
		nextPutAll: (aCodeGen jsFunctionNameFor: self selectorForCodeGeneration);
		nextPut: $(.
	args
		do: [:arg | aStream nextPutAll: (aCodeGen returnPrefixFromVariable: arg)]
		separatedBy: [ aStream nextPutAll: ', ' ].
	aStream nextPut: $)