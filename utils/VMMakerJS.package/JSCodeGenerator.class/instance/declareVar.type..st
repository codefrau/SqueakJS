public
declareVar: varName type: type
	"This both creates a varable and provides its type"
	self var: (variables add: varName asString) type: type