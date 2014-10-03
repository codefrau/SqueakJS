private
assign: variable expression: expression

	^TAssignmentNode new
		setVariable: variable
		expression: expression