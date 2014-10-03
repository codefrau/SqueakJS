JS translation
generateShiftRight: msgNode on: aStream indent: level
	"Generate the JS code for unsigned right-shift onto the given stream."
	| rcvr arg |

	rcvr := msgNode receiver.
	arg := msgNode args first.
	arg isConstant ifTrue: [
		"bit shift amount is a constant"
		arg value < 31 ifTrue: [
			aStream nextPutAll: '('.
			self emitJSExpression: rcvr on: aStream.
				aStream nextPutAll: ' >>> ', arg value printString.
			aStream nextPutAll: ')'.
		] ifFalse: [
			self error: 'cannot shift by more than 31'
		].
	] ifFalse: [
		"bit shift amount is an expression"
		aStream nextPutAll: '('.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ' > 31 ? 0 : '.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ' >>> '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ')'.
	].