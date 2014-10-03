JS translation
generateSignedBitShift: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| arg rcvr |
	arg := msgNode args first.
	rcvr := msgNode receiver.
	arg isConstant ifTrue: [
		"bit shift amount is a constant"
		aStream nextPutAll: '('.
		self emitJSExpression: rcvr on: aStream.
		arg value < 0 ifTrue: [
			aStream nextPutAll: ' >> ', arg value negated printString.
		] ifFalse: [
			aStream nextPutAll: ' << ', arg value printString.
		].
		aStream nextPutAll: ')'.
	] ifFalse: [
		"bit shift amount is an expression"
		aStream nextPutAll: '('.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ' < 0 ? '.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ' >> (0 - '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ') : '.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ' << '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ')'.
	].