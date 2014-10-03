utilities
copy
	"Make a deep copy of this JSMethod."

	^ (self class basicNew)
		setSelector: selector
		returnType: returnType
		args: args copy
		locals: locals copy
		declarations: declarations copy
		primitive: primitive
		parseTree: parseTree copyTree
		labels: labels copy
		complete: complete;
		sharedLabel: sharedLabel;
		sharedCase: sharedCase;
		yourself
