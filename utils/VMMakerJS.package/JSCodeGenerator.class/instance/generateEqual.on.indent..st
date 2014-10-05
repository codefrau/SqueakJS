JS translation
generateEqual: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| argNode test |
	argNode :=  msgNode args first.
	argNode isInterpreterProxyConstant ifTrue: [
		test := #(isNil isTrue isFalse) at: (#(nilObject trueObject falseObject) indexOf: argNode selector).
		self emitJSExpression: msgNode receiver on: aStream.
		^aStream nextPut: $.; nextPutAll: test].
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: ' === '.
	self emitJSExpression: argNode on: aStream.