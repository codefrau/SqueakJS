public
var: varName declareC: declarationString
	"Record the given C declaration for a global variable."

	(declarationString includesSubString: varName) ifFalse:
		[self error: 'declaration omits variable name.  probably an error.  use e.g. var:type:'].
	variableDeclarations at: varName asString put: declarationString.