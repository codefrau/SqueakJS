JS translation
generateIfTrueIfFalseAsArgument: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	(self nilOrBooleanConstantReceiverOf: msgNode)
		ifNil:
			[aStream nextPut: $(.
			msgNode receiver emitJSCodeAsArgumentOn: aStream level: level generator: self.
			aStream crtab: level + 1; nextPut: $?; space.
			msgNode args first emitJSCodeAsArgumentOn: aStream level: level + 2 generator: self.
			aStream crtab: level + 1; nextPut: $:; space.
			msgNode args last emitJSCodeAsArgumentOn: aStream level: level + 2 generator: self.
			aStream nextPut: $)]
		ifNotNil:
			[:const|
			(const ifTrue: [msgNode args first] ifFalse: [msgNode args last])
				emitJSCodeAsArgumentOn: aStream level: level generator: self]