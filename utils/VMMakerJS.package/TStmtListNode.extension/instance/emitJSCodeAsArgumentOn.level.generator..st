*vmmakerjs
emitJSCodeAsArgumentOn: aStream level: level generator: aCodeGen

	| statementWasComment |
	statementWasComment := false.
	statements
		do:
			[:s |
			s emitJSCommentOn: aStream level: level.
			s emitJSCodeAsArgumentOn: aStream level: 0 generator: aCodeGen.
			statementWasComment := s isComment]
		separatedBy:
			[((self endsWithCloseBracket: aStream)
			  or: [statementWasComment]) ifFalse: [aStream nextPut: $,]]