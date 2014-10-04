JS translation
generateSignedBitShift: msgNode on: aStream indent: level
	"Generate the JS code for signedBitShift: onto the given stream."

	| arg rcvr |
	arg := msgNode args first.
	rcvr := msgNode receiver.
	arg isConstant ifTrue: [
		"bit shift amount is a constant"
		self emitJSExpression: rcvr on: aStream.
		arg value < 0 ifTrue: [
			aStream nextPutAll: ' >> ', arg value negated printString.
		] ifFalse: [
			aStream nextPutAll: ' << ', arg value printString.
		].
	] ifFalse: [
		self error: 'non-constant signed shift not implemented yet'
	].