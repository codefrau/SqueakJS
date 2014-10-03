primitive compilation
fetchRcvrExpr
	"Return the parse tree for an expression that fetches the receiver from the stack."

	| expr |
	expr := 'rcvr := ', self vmNameString, ' stackValue: (', args size printString, ')'.
	^ self statementsFor: expr varName: ''
