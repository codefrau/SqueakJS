JS translation
generateBitShift: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| arg rcvr |
	arg := msgNode args first.
	rcvr := msgNode receiver.
	arg isConstant ifTrue: [
		"bit shift amount is a constant"
		arg value < 0 ifTrue: [
			"skip unneeded coercion to unsigned"
			(rcvr isSend and: [rcvr selector = #cCoerce:to: and: [rcvr args second value = 'unsigned']])
				ifTrue: [self emitJSExpression: rcvr args first on: aStream]
				ifFalse: [self emitJSExpression: rcvr on: aStream].
			aStream nextPutAll: ' >>> ', arg value negated printString.
		] ifFalse: [
			self emitJSExpression: rcvr on: aStream.
			aStream nextPutAll: ' << ', arg value printString.
		].
	] ifFalse: [
		"bit shift amount is an expression"
		aStream nextPutAll: 'SHIFT('.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ', '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ')'.
	].