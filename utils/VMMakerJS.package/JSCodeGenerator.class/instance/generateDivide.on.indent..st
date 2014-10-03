JS translation
generateDivide: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| rcvr arg divisor |
	rcvr := msgNode receiver.
	arg := msgNode args first.
	(arg isConstant and:
	 [UseRightShiftForDivide and:
	 [(divisor := arg value) isInteger and:
	 [divisor isPowerOfTwo and:
	 [divisor > 0 and:
	 [divisor <= (1 bitShift: 31)]]]]])
	ifTrue: [
		"use signed (arithmetic) right shift instead of divide"
		aStream nextPutAll: '('.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ' >> ', (divisor log: 2) asInteger printString.
		aStream nextPutAll: ')'.
	] ifFalse: [
		"use float divide and coerce to integer"
		aStream nextPutAll: '('.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ' / '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: '|0)'.
	].
