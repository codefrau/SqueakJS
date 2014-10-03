JS translation
generateInlineCCodeAsArgument: msgNode on: aStream indent: level
	"Generate the C code for this message onto the given stream.
	 There are two forms, self cCode: aString ... and self cCode: aBlock."

	msgNode args first isConstant
		ifTrue: [self generateJSCodeForCcode: msgNode args first value
			on: aStream indent: level]
		ifFalse: [msgNode args first
					emitCCodeAsArgumentOn: aStream
					level: level
					generator: self]