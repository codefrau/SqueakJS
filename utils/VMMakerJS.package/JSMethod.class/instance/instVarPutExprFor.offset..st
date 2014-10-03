primitive compilation
instVarPutExprFor: varName offset: instIndex
	"Return the parse tree for an expression that saves the value of the integer instance variable at the given offset."

	| expr |
	(declarations includesKey: varName) ifTrue: [
		self error: 'a primitive method can only modify integer instance variables'.
	].
	expr := '', self vmNameString, ' storeInteger: ', instIndex printString, ' ofObject: rcvr withValue: ', varName.
	^ self statementsFor: expr varName: varName
