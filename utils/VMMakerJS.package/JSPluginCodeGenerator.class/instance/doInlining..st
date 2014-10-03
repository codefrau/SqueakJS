inlining
doInlining: inlineFlag
"do inlining for a plugin"
	self doBasicInlining: inlineFlag.
	self permitMethodPruning
		ifTrue: [self pruneUnreachableMethods]
