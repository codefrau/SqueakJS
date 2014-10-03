inlining support
renameVarsForInliningInto: destMethod in: aCodeGen
	"Rename any variables that would clash with those of the destination method."

	| destVars usedVars varMap newVarName |
	destVars := aCodeGen globalsAsSet copy.
	destVars addAll: destMethod locals.
	destVars addAll: destMethod args.
	usedVars := destVars copy.  "keeps track of names in use"
	usedVars addAll: args; addAll: locals.
	varMap := Dictionary new: 100.
	args, locals do: [ :v |
		(destVars includes: v) ifTrue: [
			newVarName := self unusedNamePrefixedBy: v avoiding: usedVars.
			varMap at: v put: newVarName.
		].
	].
	self renameVariablesUsing: varMap.