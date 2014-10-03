transforming
extractSuppressFailureGuardDirective
	"Scan the top-level statements for a pragma directive of the form:

		self suppressFailureGuards: <boolean>

	 and remove the directive from the method body. Answer the argument of the directive or false if there is no #supressFailureGuards: directive."

	| result newStatements |
	result := false.
	newStatements := OrderedCollection new: parseTree statements size.
	parseTree statements do: [ :stmt |
		(stmt isSend and: [stmt selector = #suppressFailureGuards:]) ifTrue: [
			result := stmt args first name = 'true'.
		] ifFalse: [
			newStatements add: stmt.
		].
	].
	parseTree setStatements: newStatements asArray.
	^ result