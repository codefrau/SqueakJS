transformations
prepareMethodIn: aCodeGen
	"Record sends of builtin operators and replace sends of the special selector dispatchOn:in: with case statement nodes."
	"Note: Only replaces top-level sends of dispatchOn:in:. Case statements must be top-level statements; they cannot appear in expressions."

	| stmts stmt |
	parseTree nodesDo: [ :node |
		node isSend ifTrue: [
			"record sends of builtin operators"
			(aCodeGen builtin: node selector) ifTrue: [ node isBuiltinOperator: true ].
		].
		node isStmtList ifTrue: [
			"replace dispatchOn:in: with case statement node"
			stmts := node statements.
			1 to: stmts size do: [ :i |
				stmt := stmts at: i.
				(stmt isSend and: [CaseStatements includes: stmt selector]) ifTrue: [
					stmts at: i put: (self buildCaseStmt: stmt).
				].
			].
		].
	].