JS translation
generateShiftRight: msgNode on: aStream indent: level
	"Generate the JS code for unsigned right-shift onto the given stream."
	| rcvr arg |

	rcvr := msgNode receiver.
	arg := msgNode args first.
	arg isConstant ifTrue: [
		"bit shift amount is a constant"
		arg value < 31 ifTrue: [
			self emitJSExpression: rcvr on: aStream.
				aStream nextPutAll: ' >>> ', arg value printString.
		] ifFalse: [
			self error: 'cannot shift by more than 31'
		].
	] ifFalse: [
		"bit shift amount is an expression"
		aStream nextPutAll: 'SHR('.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ', '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ')'.
	].