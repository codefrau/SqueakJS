inlining
removeMethodsReferingToGlobals: varList except: methodNames
	"Remove any methods (presumably inlined) that still contain references to the given obsolete global variables."

	| varListAsStrings mVars |
	varListAsStrings := varList collect: [ :sym | sym asString ].
		(methods keys copyWithoutAll: methodNames) do: [ :sel |
			mVars := (self methodNamed: sel) freeVariableReferences asSet.
			(mVars includesAnyOf: varListAsStrings)
				ifTrue: [methods removeKey: sel ifAbsent: []]]
