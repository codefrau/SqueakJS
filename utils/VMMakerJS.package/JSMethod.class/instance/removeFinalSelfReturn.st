transformations
removeFinalSelfReturn
	"The Smalltalk parser automatically adds the statement '^self' to the end of methods without explicit returns. This method removes such statements, since the generated code has no notion of 'self' anyway."

	| stmtList lastStmt |
	stmtList := parseTree statements asOrderedCollection.
	lastStmt := stmtList last.

	((lastStmt isReturn) and:
	 [(lastStmt expression isVariable) and:
	 ['self' = lastStmt expression name]]) ifTrue: [
		stmtList removeLast.
		parseTree setStatements: stmtList.
	].