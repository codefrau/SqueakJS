inlining support
renameVariablesUsing: aDictionary
	"Rename all variables according to old->new mappings of the given dictionary."

	| newDecls newKey newValue |
	"map args and locals"
	args := args collect: [ :arg |
		(aDictionary includesKey: arg) ifTrue: [ aDictionary at: arg ] ifFalse: [ arg ].
	].
	locals := locals collect: [ :v |
		(aDictionary includesKey: v) ifTrue: [ aDictionary at: v ] ifFalse: [ v ].
	].
	"prevent runaway recursion, e.g. inlining a method with super send"
	locals size > 1000 ifTrue: [self error: 'recursive inlining in ', selector asString, ', too many locals'].

	"map declarations"
	newDecls := declarations species new.
	declarations associationsDo: [ :assoc |
		(aDictionary includesKey: assoc key)
			ifTrue: [ newKey := aDictionary at: assoc key.
					newValue := assoc value replaceLastOccurrence: assoc key with: newKey.
					newDecls at: newKey put: newValue]
			ifFalse: [ newDecls add: assoc ].
	].
	declarations := newDecls.

	"map variable names in parse tree"
	parseTree nodesDo: [ :node |
		(node isVariable and:
		 [aDictionary includesKey: node name]) ifTrue: [
			node setName: (aDictionary at: node name).
		].
		(node isStmtList and: [node args size > 0]) ifTrue: [
			node setArguments:
				(node args collect: [ :arg |
					(aDictionary includesKey: arg)
						ifTrue: [ aDictionary at: arg ]
						ifFalse: [ arg ].
				]).
		].
	].