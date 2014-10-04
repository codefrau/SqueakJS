JS translation
generateBitShift: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| arg rcvr |
	arg := msgNode args first.
	rcvr := msgNode receiver.
	arg isConstant ifTrue: [
		"bit shift amount is a constant"
		self emitJSExpression: rcvr on: aStream.
		arg value < 0 ifTrue: [
			aStream nextPutAll: ' >>> ', arg value negated printString.
		] ifFalse: [
			aStream nextPutAll: ' << ', arg value printString.
		].
	] ifFalse: [
		"bit shift amount is an expression"
		self error: 'need to add BITSHIFT to emitJSHeaderOn:'.
		aStream nextPutAll: 'BITSHIFT('.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ', '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ')'.
	].