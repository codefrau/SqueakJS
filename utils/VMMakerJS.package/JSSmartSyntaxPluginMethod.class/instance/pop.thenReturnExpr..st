private
pop: anInteger thenReturnExpr: anExpression

	^TSendNode new
		setSelector: #pop:thenPush:
		receiver: (TVariableNode new setName: 'interpreterProxy')
		arguments: (Array 
			with: (TConstantNode new 
				setValue: anInteger)
			with: anExpression)