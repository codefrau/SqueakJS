error notification
checkClassForNameConflicts: aClass
	"Verify that the given class does not have constant, variable, or method names that conflict with
	 those of previously added classes. Raise an error if a conflict is found, otherwise just return."

	"check for constant name collisions in class pools"
	aClass classPool associationsDo:
		[:assoc |
		(constants includesKey: assoc key asString) ifTrue:
			[self error: 'Constant ', assoc key, ' was defined in a previously added class']].

	"and in shared pools"
	(aClass sharedPools reject: [:pool| pools includes: pool]) do:
		[:pool |
		pool bindingsDo:
			[:assoc |
			(constants includesKey: assoc key asString) ifTrue:
				[self error: 'Constant ', assoc key, ' was defined in a previously added class']]].

	"check for instance variable name collisions"
	(aClass inheritsFrom: VMStructType) ifFalse:
		[aClass instVarNames do:
			[:varName |
			(variables includes: varName) ifTrue:
				[self error: 'Instance variable ', varName, ' was defined in a previously added class']]].

	"check for method name collisions"
	aClass selectors do:
		[:sel |
		((methods includesKey: sel) and:
			[ | meth |
			meth := aClass compiledMethodAt: sel.
			meth isAbstract not and: [(meth pragmaAt: #doNotGenerate) isNil]]) ifTrue:
				[self error: 'Method ', sel, ' was defined in a previously added class.']]