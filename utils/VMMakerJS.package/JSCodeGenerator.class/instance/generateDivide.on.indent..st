JS translation
generateDivide: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| rcvr arg divisor |
	rcvr := msgNode receiver.
	arg := msgNode args first.
	(msgNode selector == #/ and: [self pluginName = 'ScratchPlugin']) ifTrue: [
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ' / '.
		^self emitJSExpression: arg on: aStream].
	(arg isConstant and:
	 [UseRightShiftForDivide and:
	 [(divisor := arg value) isInteger and:
	 [divisor isPowerOfTwo and:
	 [divisor > 0 and:
	 [divisor <= (1 bitShift: 31)]]]]])
	ifTrue: [
		"use signed (arithmetic) right shift instead of divide"
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ' >> ', (divisor log: 2) asInteger printString.
	] ifFalse: [
		"use float divide and coerce to integer"
		aStream nextPutAll: 'DIV('.
		self emitJSExpression: rcvr on: aStream.
		aStream nextPutAll: ', '.
		self emitJSExpression: arg on: aStream.
		aStream nextPutAll: ')'.
	].
