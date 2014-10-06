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
			arg value < -31 ifTrue: [self error: 'cannot shift by more than 31']. 
			aStream nextPutAll: ' >> ', arg value negated printString.
		] ifFalse: [
			arg value > 31 ifTrue: [self error: 'cannot shift by more than 31']. 
			aStream nextPutAll: ' << ', arg value printString.
		].
	] ifFalse: [
		self error: 'non-constant signed shift not implemented yet'
	].