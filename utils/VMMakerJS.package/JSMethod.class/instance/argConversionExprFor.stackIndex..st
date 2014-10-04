primitive compilation
argConversionExprFor: varName stackIndex: stackIndex 
	"Return the parse tree for an expression that fetches and converts the 
	primitive argument at the given stack offset."
	| exprList decl stmtList |
	oneBasedArrays ifNil: [oneBasedArrays := Set new]. "only non-nil in a primitive method"
	exprList := OrderedCollection new.
	(declarations includesKey: varName) ifTrue:[
		decl := declarations at: varName.
		(decl includes: $*) ifTrue:["array"
			(decl includesSubString: 'char') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' stackBytes: ',stackIndex printString] ifFalse: [
			(decl beginsWith: 'unsigned short') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' stackUint16Array: ',stackIndex printString] ifFalse: [
			(decl beginsWith: 'int') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' stackInt32Array: ',stackIndex printString]
			ifFalse: [self halt]]].
			self beOneBasedArray: varName.
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