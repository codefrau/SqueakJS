JS translation
generateDoWhileTrue: msgNode on: aStream indent: level
	"Generate do {stmtList} while(cond)"

	| stmts testStmt |
	stmts := msgNode receiver statements asOrderedCollection.
	testStmt := stmts removeLast.
	msgNode receiver setStatements: stmts.
	aStream nextPutAll: 'do {'; cr.
	msgNode receiver emitJSCodeOn: aStream level: level + 1 generator: self.
	level timesRepeat: [ aStream tab ].
	aStream nextPutAll: '} while('.
	testStmt asExpression emitJSCodeOn: aStream level: 0 generator: self.
	aStream nextPutAll: ')'.