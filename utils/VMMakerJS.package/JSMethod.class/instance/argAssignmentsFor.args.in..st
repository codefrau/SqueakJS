inlining
argAssignmentsFor: meth args: argList in: aCodeGen
	"Return a collection of assignment nodes that assign the given argument expressions to the formal parameter variables of the given method."
	"Optimization: If the actual parameters are either constants or local variables in the target method (the receiver), substitute them directly into the body of meth. Note that global variables cannot be subsituted because the inlined method might depend on the exact ordering of side effects to the globals."

	| stmtList substitutionDict |
	stmtList := OrderedCollection new: 100.
	substitutionDict := Dictionary new: 100.
	meth args with: argList do: [ :argName :exprNode |
		(self isSubstitutableNode: exprNode intoMethod: meth in: aCodeGen) ifTrue: [
			substitutionDict at: argName put: exprNode.
			locals remove: argName.
		] ifFalse: [
			stmtList add: (TAssignmentNode new
				setVariable: (TVariableNode new setName: argName)
				expression: exprNode copyTree).
		].
	].
	meth parseTree: (meth parseTree bindVariablesIn: substitutionDict).
	^stmtList