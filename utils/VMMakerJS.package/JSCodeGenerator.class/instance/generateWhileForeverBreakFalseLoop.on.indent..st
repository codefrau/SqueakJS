JS translation
generateWhileForeverBreakFalseLoop: msgNode on: aStream indent: level
	"Generate while(true) {stmtListA; if(!(cond)) break; stmtListB}."

	| stmts testStmt |
	stmts := msgNode receiver statements asOrderedCollection.
	testStmt := stmts removeLast.
	msgNode receiver setStatements: stmts.
	level - 1 timesRepeat: [ aStream tab ].
	aStream nextPutAll: 'while (true) {'; cr.
	msgNode receiver emitJSCodeOn: aStream level: level + 1 generator: self.
	(level + 1) timesRepeat: [ aStream tab ].
	aStream nextPutAll: 'if (!('.
	testStmt asExpression emitJSCodeOn: aStream level: 0 generator: self.
	aStream nextPutAll: ')) break;'; cr.
	msgNode args first emitJSCodeOn: aStream level: level + 1 generator: self.
	level timesRepeat: [ aStream tab ].
	aStream nextPutAll: '}'.