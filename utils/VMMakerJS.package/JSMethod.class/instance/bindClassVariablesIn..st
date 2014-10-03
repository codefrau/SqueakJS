transformations
bindClassVariablesIn: constantDictionary
	"Class variables are used as constants. This method replaces all references to class variables in the body of this method with the corresponding constant looked up in the class pool dictionary of the source class. The source class class variables should be initialized before this method is called."

	parseTree := parseTree bindVariablesIn: constantDictionary.