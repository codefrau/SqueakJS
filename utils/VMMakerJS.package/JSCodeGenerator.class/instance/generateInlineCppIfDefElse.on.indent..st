JS translation
generateInlineCppIfDefElse: msgNode on: aStream indent: level
	"Generate the C code for this message onto the given stream."

	| alternateBlock alternateBlockIsNil |
	aStream nextPutAll: '// skipping ifdef ', msgNode args first value; cr.

	alternateBlock := msgNode args fifth.
	alternateBlockIsNil := true. "check for nil #else clause"
	alternateBlock nodesDo: [:n |
		(n ~= alternateBlock and: [n name ~= 'nil'])
			ifTrue: [alternateBlockIsNil := false ]].
	(alternateBlockIsNil) ifFalse:
		[msgNode isExpression
			ifTrue:
				[aStream tab: level + 1; nextPut: $(.
				alternateBlock asExpression
					emitJSCodeOn: aStream level: level + 1 generator: self.
				aStream nextPut: $); cr]
			ifFalse:
				[alternateBlock
					emitJSCodeOn: aStream level: level generator: self]].

