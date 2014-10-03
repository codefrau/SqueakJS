utilities
checkForGlobalUsage: vars in: aJSMethod 
	| item |
	vars
		do: [:var | 
			"TPR - why the use of globalsAsSet here instead of globalVariables? 
			JMM - globalVariables is not initialized yet, variables is an OrderedCollection, 
				globalsAsSet returns variables as needed set"
			(self globalsAsSet includes: var)
				ifTrue: ["find the set of method names using this global var"
					item := globalVariableUsage
								at: var
								ifAbsent: [globalVariableUsage at: var put: Set new].
					"add this method name to that set"
					item add: aJSMethod selector]].
	aJSMethod referencesGlobalStructMakeZero