*vmmakerjs
emitJSCodeOn: aStream level: level generator: aCodeGen

	self emitJSCommentOn: aStream level: level.
	statements do: [:s |
		s emitJSCommentOn: aStream level: level.
		aStream tab: level.
		s emitJSCodeOn: aStream level: level generator: aCodeGen.
		(((self endsWithCloseBracket: aStream) not
			and: [(s isComment) not])
				and: [s requiresCLineTerminator])
			ifTrue: [aStream nextPut: $;].
		aStream cr].
