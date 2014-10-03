primitive compilation
instVarGetExprFor: varName offset: instIndex
	"Return the parse tree for an expression that fetches and converts the value of the instance variable at the given offset."

	| exprList decl stmtList |
	exprList := OrderedCollection new.
	(declarations includesKey: varName) ifTrue: [
		decl := declarations at: varName.
		(decl includes: $*) ifTrue: [  "array"
			exprList add:
				(varName, ' := ', self vmNameString, ' fetchArray: ', instIndex printString, ' ofObject: rcvr').
			exprList add: (varName, ' := ', varName, ' - 1').
		] ifFalse: [  "must be a double"
			((decl findString: 'double' startingAt: 1) = 0)
				ifTrue: [ self error: 'unsupported type declaration in a primitive method' ].
			exprList add:
				(varName, ' := ', self vmNameString, ' fetchFloat: ', instIndex printString, ' ofObject: rcvr').
		].
	] ifFalse: [  "undeclared variables are taken to be integer"
		exprList add:
			(varName, ' := ', self vmNameString, ' fetchInteger: ', instIndex printString, ' ofObject: rcvr').
	].
	stmtList := OrderedCollection new.
	exprList do: [:e | stmtList addAll: (self statementsFor: e varName: varName)].
	^ stmtList
