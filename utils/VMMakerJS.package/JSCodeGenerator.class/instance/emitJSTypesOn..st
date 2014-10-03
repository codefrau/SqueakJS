JS code generator
emitJSTypesOn: aStream 
	"Store local type declarations on the given stream."
	vmClass ifNotNil:
		[vmClass ancilliaryStructClasses do:
			[:structClass|
			(vmClass shouldGenerateTypedefFor: structClass) ifTrue:
				[structClass printTypedefOn: aStream.
				 aStream cr; cr]]]