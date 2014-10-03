transforming
fixUpReturns
	"Replace each return statement in this method with (a) the given postlog, (b) code to pop the receiver and the given number of arguments, and (c) code to push the integer result and return."

	parseTree nodesDo: [:node |
		node isStmtList ifTrue: [
			node setStatements: (Array streamContents:
				[:sStream |
				 node statements do: 
					[:stmt | self fixUpReturnOneStmt: stmt on: sStream]])]]