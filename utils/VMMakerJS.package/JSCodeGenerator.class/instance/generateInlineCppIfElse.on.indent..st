JS translation
generateInlineCppIfElse: msgNode on: aStream indent: level
	"Generate the C code for this message onto the given stream."

	| comment alternateBlock alternateBlockIsNil |
self halt.
	aStream cr; nextPutAll: '# if (', msgNode args first value, ')'.
	comment := msgNode args third value.
	(comment isKindOf: String)
		ifTrue: [aStream nextPutAll: '  // ', comment]
		ifFalse: ["nil argument, ignore it"].
	aStream cr.
	msgNode isExpression
		ifTrue:
			[aStream tab: level + 1; nextPut: $(.
			msgNode args fourth asExpression
				emitJSCodeOn: aStream level: level + 1 generator: self.
			aStream nextPut: $); cr]
		ifFalse:
			[msgNode args fourth
				emitJSCodeOn: aStream level: level generator: self].
	alternateBlock := msgNode args fifth.
	alternateBlockIsNil := true. "check for nil #else clause"
	alternateBlock nodesDo: [:n |
		(n ~= alternateBlock and: [n name ~= 'nil'])
			ifTrue: [alternateBlockIsNil := false ]].
	(alternateBlockIsNil) ifFalse:
		[aStream nextPutAll: '# else'; cr.
		msgNode isExpression
			ifTrue:
				[aStream tab: level + 1; nextPut: $(.
				alternateBlock asExpression
					emitJSCodeOn: aStream level: level + 1 generator: self.
				aStream nextPut: $); cr]
			ifFalse:
				[alternateBlock
					emitJSCodeOn: aStream level: level generator: self]].
	aStream nextPutAll: '# endif  // ', msgNode args first value; cr; tab: level
