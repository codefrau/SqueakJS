JS translation
generateIfTrue: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	(self nilOrBooleanConstantReceiverOf: msgNode)
		ifNil:
			[aStream nextPutAll: 'if ('.
			msgNode receiver emitJSCodeAsExpressionOn: aStream level: level generator: self.
			aStream nextPutAll: ') {'; cr.
			msgNode args first emitJSCodeOn: aStream level: level + 1 generator: self.
			level timesRepeat: [ aStream tab ].
			aStream nextPut: $}]
		ifNotNil:
			[:const |
			const ifTrue:
				[msgNode args first emitJSCodeOn: aStream level: level generator: self]]