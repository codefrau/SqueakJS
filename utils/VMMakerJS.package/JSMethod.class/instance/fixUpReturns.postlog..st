primitive compilation
fixUpReturns: argCount postlog: postlog
	"Replace each return statement in this method with (a) the given postlog, (b) code to pop the receiver and the given number of arguments, and (c) code to push the integer result and return."

	| newStmts |
	parseTree nodesDo: [:node |
		node isStmtList ifTrue: [
			newStmts := OrderedCollection new: 100.
			node statements do: [:stmt |
				stmt isReturn
					ifTrue: [
						(stmt expression isSend and:
						 ['primitiveFail' = stmt expression selector])
							ifTrue: [  "failure return"
								newStmts addLast: stmt expression.
								newStmts addLast: (TReturnNode new
									setExpression: (TVariableNode new setName: 'null'))]
							ifFalse: [  "normal return"
								newStmts addAll: postlog.
								newStmts addAll: (self popArgsExpr: argCount + 1).
								newStmts addLast: (TSendNode new
									setSelector: #pushInteger:
									receiver: (TVariableNode new setName: self vmNameString)
									arguments: (Array with: stmt expression)).
								newStmts addLast: (TReturnNode new
									setExpression: (TVariableNode new setName: 'null'))]]
					ifFalse: [
						newStmts addLast: stmt]].
			node setStatements: newStmts asArray]].
