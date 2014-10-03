primitive compilation
popArgsExpr: argCount
	"Return the parse tree for an expression that pops the given number of arguments from the stack."

	| expr |
	expr := '', self vmNameString, ' pop: ', argCount printString.
	^ self statementsFor: expr varName: ''
