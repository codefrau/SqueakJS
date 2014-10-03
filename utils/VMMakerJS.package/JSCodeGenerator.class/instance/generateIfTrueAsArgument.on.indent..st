JS translation
generateIfTrueAsArgument: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	(self nilOrBooleanConstantReceiverOf: msgNode)
		ifNil:
			[aStream nextPut: $(.
			 msgNode receiver emitJSCodeAsArgumentOn: aStream level: level generator: self.
			 aStream crtab: level + 1; nextPut: $?; space.
			 msgNode args first emitJSCodeAsArgumentOn: aStream level: level + 2 generator: self.
			 aStream crtab: level + 1; nextPutAll: ': 0)']
		ifNotNil:
			[:const|
			const ifTrue:
				[msgNode args first emitJSCodeAsArgumentOn: aStream level: level generator: self]]