JS code generator
typeOfArgument: argIndex in: selector
	| method |
	method := methods at: selector.
	^method declarations at: (method args at: argIndex).
