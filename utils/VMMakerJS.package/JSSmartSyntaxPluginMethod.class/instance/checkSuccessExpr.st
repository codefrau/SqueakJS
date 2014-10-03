private
checkSuccessExpr
	"Return the parse tree for an expression that aborts the primitive if primFailCode is set."

	| expr |
	expr := 'interpreterProxy failed ifTrue: [^nil]'.
	^ self statementsFor: expr varName: ''
