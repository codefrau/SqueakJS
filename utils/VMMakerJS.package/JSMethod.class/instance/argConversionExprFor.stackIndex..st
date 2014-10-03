primitive compilation
argConversionExprFor: varName stackIndex: stackIndex 
	"Return the parse tree for an expression that fetches and converts the 
	primitive argument at the given stack offset."
	| exprList decl stmtList |
	exprList := OrderedCollection new.
	(declarations includesKey: varName) ifTrue:[
		decl := declarations at: varName.
		(decl includes: $*) ifTrue:["array"
			(decl includesSubString: 'char') ifTrue:[ | expr |
				expr := '(interpreterProxy isBytes: (interpreterProxy stackValue: (stackIndex))) ifFalse:[^interpreterProxy primitiveFail].'.
				expr := expr copyReplaceAll: 'interpreterProxy' with: self vmNameString.
				expr := expr copyReplaceAll: 'stackIndex' with: stackIndex printString.
				exprList add: expr.
			].
			exprList add: varName , ' := ', self vmNameString, ' arrayValueOf: (', self vmNameString, ' stackValue: (' , stackIndex printString , '))'.
			exprList add: varName , ' := ' , varName , ' - 1'.
		] ifFalse:["must be a double"
			(decl findString: 'double' startingAt: 1) = 0 ifTrue: [
				self error: 'unsupported type declaration in a primitive method'
			].
			exprList add: varName , ' := ', self vmNameString, ' stackFloatValue: ' , stackIndex printString.
		]
	] ifFalse: ["undeclared variables are taken to be integer"
		exprList add: varName , ' := ', self vmNameString, ' stackIntegerValue: ' , stackIndex printString
	].
	stmtList := OrderedCollection new.
	exprList do: [:e | stmtList addAll: (self statementsFor: e varName: varName)].
	^ stmtList