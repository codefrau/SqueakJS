inlining support
extractInlineDirective
	"Scan the top-level statements for an inlining directive of the form:

		self inline: <boolean>

	 and remove the directive from the method body. Return the argument of the directive or #dontCare if there is no inlining directive."

	| result newStatements methodDirectiveFound |
	sharedCase ifNotNil:[^false]. "don't auto-inline shared code; it gets handled specially"
	result := #dontCare.
	methodDirectiveFound := false.
	newStatements := OrderedCollection new: parseTree statements size.
	parseTree statements do: [ :stmt |
		(stmt isSend and: [stmt selector = #inline:]) ifTrue: [
			methodDirectiveFound := true.
			result := stmt args first value = true.
		] ifFalse: [
			newStatements add: stmt.
		].
	].
	parseTree setStatements: newStatements asArray.
	methodDirectiveFound ifTrue: [^ result].
	"no method declaration was used, so check for a pragma declaration"
	sharedCase ifNotNil: [^false]. "don't auto-inline shared code; it gets handled specially"
	^self
		extractDirective: #inline:
		valueBlock: [:sendNode| sendNode args first value = true]
		default: #dontCare