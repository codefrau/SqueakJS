transformations
extractExportDirective
	"Scan the top-level statements for an inlining directive of the form:

		self export: <boolean>

	 and remove the directive from the method body. Return the argument of the directive or false if there is no export directive."

	| result newStatements methodDirectiveFound |
	result := false.
	methodDirectiveFound := false.
	newStatements := OrderedCollection new: parseTree statements size.
	parseTree statements do: [ :stmt |
		(stmt isSend and: [stmt selector = #export:]) ifTrue: [
			methodDirectiveFound := true.
			result := stmt args first value = true.
		] ifFalse: [
			newStatements add: stmt.
		].
	].
	parseTree setStatements: newStatements asArray.
	methodDirectiveFound ifTrue: [^ result].
	"no method declaration was used, so check for a pragma declaration"
	^self
		extractDirective: #export:
		valueBlock: [:sendNode| sendNode args first value ~= false]
		default: false
