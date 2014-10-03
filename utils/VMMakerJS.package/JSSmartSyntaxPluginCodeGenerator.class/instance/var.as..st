transforming
var: varName as: aClass
	"Record the given C declaration for a global variable"

	variableDeclarations at: varName asString put: (aClass jscgDeclareJSForVar: varName)