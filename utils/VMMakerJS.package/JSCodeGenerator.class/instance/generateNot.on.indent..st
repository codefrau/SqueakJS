JS translation
generateNot: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| expr |
	expr := msgNode receiver.
	"generate (a != b) instead of !(a == b)"
	expr isEqualityTest ifTrue: [
		^(msgNode selector includes: $~)
			ifTrue: [self generateEqual: expr on: aStream indent: level]
			ifFalse: [self generateNotEqual: expr on: aStream indent: level]].
	"eliminate not not"
	(expr isSend and: [expr selector = #not]) ifTrue: [
		^self emitJSExpression: expr receiver on: aStream].
	aStream nextPutAll: '!'.
	self emitJSExpression: expr on: aStream.