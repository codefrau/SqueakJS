JS translation
generatePlus: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	msgNode receiver isBitBltPtr ifFalse: [
		self checkNonPointer: msgNode args first op: '+'.
		self ifPointerVar: msgNode receiver then: [:type |
			(self generatePointerPlus: msgNode type: type on: aStream indent: level)
				ifTrue: [^self].
			self halt: 'cannot do + with ', type].
		self emitJSExpression: msgNode receiver on: aStream.
		aStream nextPutAll: ' + '].
	self emitJSExpression: msgNode args first on: aStream.