inlining support
renameVarsForCaseStmt
	"Rename the arguments and locals of this method with names like t1, t2, t3, etc. Return the number of variable names assigned. This is done to allow registers to be shared among the cases."

	| i varMap |
	i := 1.
	varMap := Dictionary new: 100.
	args, locals do: [ :v |
		varMap at: v put: ('t', i printString) asSymbol.
		i := i + 1.
	].
	self renameVariablesUsing: varMap.
	^ i - 1