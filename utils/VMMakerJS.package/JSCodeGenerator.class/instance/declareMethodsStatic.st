accessing
declareMethodsStatic
	"If true generated methods will be declared static. Default is true,
	appropriate for plugins."
	^ declareMethodsStatic
		ifNil: [declareMethodsStatic := true]