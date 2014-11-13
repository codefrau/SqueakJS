JS hacks
generateMakeUnsignedFrom: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| expr type coerce |
	msgNode args size = 1 ifFalse: [self halt].
	expr := msgNode args first.
	(expr isSend and: [expr selector = #at:])
		ifFalse: [^self emitJSExpression: expr on: aStream].
	coerce := expr receiver.
	(coerce isSend and: [coerce selector = #cCoerce:to:])
		ifFalse: [^self emitJSExpression: expr on: aStream].
	type := (coerce args second value) copyWithout: $ .
	type = 'int*' ifFalse: [self halt].
	self emitJSExpression: coerce args first on: aStream.
	aStream nextPut: $[.
	expr args first emitJSCodeAsExpressionOn: aStream level: 0 generator: self.
	aStream nextPut: $].
