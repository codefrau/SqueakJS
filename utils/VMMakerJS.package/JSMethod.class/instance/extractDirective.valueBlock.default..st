transformations
extractDirective: theSelector valueBlock: aBlock default: defaultResult
	"Find a pragma of the form:

		<theSelector[args]>

	 Answer the result of evaluating aBock with a TSendNode corresponding
	 to the pragma node, or defaultResult if there is no matching pragma."

	| result found newStatements |
	(properties at: theSelector ifAbsent: []) ifNotNil:
		[:pragma|
		^aBlock value: (TSendNode new
							setSelector: pragma keyword
							receiver: (TVariableNode new setName: 'self')
							arguments: (pragma arguments collect: [:const| TConstantNode new setValue: const]))].
	"Pre-pragma backward compatibility:
	 Scan the top-level statements for a labelling directive of the form:

		self theSelector[args]

	 and remove the directive from the method body if found.
	 Answer the result of evaluating aBock with the send node,
	  or defaultResult if there is no labelling directive."	result := defaultResult.
	found := false.
	newStatements := OrderedCollection new: parseTree statements size.
	parseTree statements do:
		[ :stmt |
		(stmt isSend
		 and: [stmt selector = theSelector])
			ifTrue:
				[found := true.
				 result := aBlock value: stmt]
			ifFalse:
				[newStatements add: stmt]].
	^found
		ifTrue:
			[parseTree setStatements: newStatements asArray.
			 result]
		ifFalse: [defaultResult]