JS translation
generateIfFalseIfTrue: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	(self nilOrBooleanConstantReceiverOf: msgNode)
		ifNil:
			[aStream nextPutAll: 'if ('.
			msgNode receiver emitJSCodeAsExpressionOn: aStream level: level generator: self.
			aStream nextPutAll: ') {'; cr.
			msgNode args last emitJSCodeOn: aStream level: level + 1 generator: self.
			aStream tab: level; nextPut: $}; nextPutAll: ' else {'; cr.
			msgNode args first emitJSCodeOn: aStream level: level + 1 generator: self.
			aStream tab: level; nextPut: $}]
		ifNotNil:
			[:const |
			 (const ifTrue: [msgNode args last] ifFalse: [msgNode args first])
				emitJSCodeOn: aStream level: level generator: self]