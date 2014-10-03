public
addClassVarsFor: aClass
	"Add the class variables for the given class to the code base as constants."
	| val node |
	aClass classPool associationsDo: [:assoc | 
		val := assoc value.
		(useSymbolicConstants and:[self isCLiteral: val])
			ifTrue:[node := TDefineNode new setName: assoc key asString value: assoc value]
			ifFalse:[node := TConstantNode new setValue: assoc value].
		constants at: assoc key asString put: node].
