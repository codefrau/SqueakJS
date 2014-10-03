private
nullReturnExpr

	^ TReturnNode new
		setExpression: (TVariableNode new setName: 'null')