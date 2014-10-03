specifying primitives
primitiveDirectiveWasHandled: stmt on: sStream

	(self isPrimitiveDirectiveSend: stmt) ifTrue:
		[^self handlePrimitiveDirective: stmt on: sStream].
	(stmt isAssignment and: 
		[self isPrimitiveDirectiveSend: stmt expression]) ifTrue:
			[^self handlePrimitiveDirective: stmt on: sStream].
	^false.
