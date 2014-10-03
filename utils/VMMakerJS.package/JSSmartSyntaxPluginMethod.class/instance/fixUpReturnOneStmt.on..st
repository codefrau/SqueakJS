transforming
fixUpReturnOneStmt: stmt on: sStream

	stmt isReturn ifFalse: [^sStream nextPut: stmt].
	(stmt expression isSend and: ['primitiveFail' = stmt expression selector]) ifTrue: 
		["failure return"
		 sStream nextPut: stmt expression.
		 sStream nextPut: self nullReturnExpr.
		 ^nil].
	(stmt expression isVariable and: ['nil' = stmt expression name]) ifTrue: 
		["^ nil -- this is never right unless automatically generated"
		 sStream nextPut: stmt.
		 ^nil].
	(stmt expression isVariable and: ['self' = stmt expression name]) ifTrue: 
		["^ self"
		 self generateFailureGuardOn: sStream.
		 fullArgs isEmpty ifFalse:[ sStream nextPut: (self popExpr: fullArgs size)].
		 sStream nextPut: self nullReturnExpr.
		 ^nil].
	(stmt expression isVariable | stmt expression isConstant | suppressingFailureGuards) ifTrue:
		["^ variable or ^ constant or ^ expr without guardchecking"
		 self generateFailureGuardOn: sStream.
		 sStream nextPut: (self pop: fullArgs size + 1 thenReturnExpr: stmt expression).
		 sStream nextPut: self nullReturnExpr.
		 ^nil].
	"^ expr with guardchecking"
	sStream nextPut: (self assign: (self oopVariable: '_return_value') expression: stmt expression).
	self generateFailureGuardOn: sStream.
	sStream nextPut: (self pop: fullArgs size + 1 thenReturnExpr: (self oopVariable: '_return_value')).
	sStream nextPut: self nullReturnExpr
