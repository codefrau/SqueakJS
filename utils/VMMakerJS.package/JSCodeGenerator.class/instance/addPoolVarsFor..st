public
addPoolVarsFor: aClass 
	"Add the pool variables for the given class to the code base as constants."

	(aClass sharedPools reject: [:pool| pools includes: pool]) do:
		[:pool |
		pools add: pool.
		pool bindingsDo: [:assoc | | val node |
			val := assoc value.
			node := (useSymbolicConstants and:[self isCLiteral: val])
						ifTrue:[TDefineNode new setName: assoc key asString value: assoc value]
						ifFalse:[TConstantNode new setValue: assoc value].
			constants at: assoc key asString put: node]].