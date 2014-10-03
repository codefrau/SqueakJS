JS code generator
pushScope: variableToType "<Dictionary>" while: aBlock
	scopeStack addLast: variableToType.
	^aBlock ensure: [scopeStack removeLast]