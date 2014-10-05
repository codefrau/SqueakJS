primitive compilation
instVarGetExprFor: varName offset: instIndex
	"Return the parse tree for an expression that fetches and converts the value of the instance variable at the given offset."

	| exprList decl stmtList |
	exprList := OrderedCollection new.
	(declarations includesKey: varName) ifTrue: [
		decl := declarations at: varName.
		(decl includes: $*) ifTrue: ["array"
			(decl includesSubString: 'char') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' fetchBytes: ', instIndex printString, ' ofObject: rcvr'] ifFalse: [
			(decl includesSubString: 'unsigned int') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' fetchWords: ', instIndex printString, ' ofObject: rcvr'] ifFalse: [
			(decl beginsWith: 'unsigned short') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' fetchUint16Array: ', instIndex printString, ' ofObject: rcvr'] ifFalse: [
			(decl beginsWith: 'short int') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' fetchInt16Array: ', instIndex printString, ' ofObject: rcvr'] ifFalse: [
			(decl beginsWith: 'int') ifTrue:[
				exprList add: varName , ' := ', self vmNameString, ' fetchInt32Array: ', instIndex printString, ' ofObject: rcvr']
			ifFalse: [self halt]]]]].
			self beOneBasedArray: varName.
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
