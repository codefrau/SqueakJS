error notification
checkAbstractMethods
	"For each method that has been declared abstract, ensure that a concrete
	implementation has been provided. This check should be performed prior to
	inlining because methods may be removed during the inlining process."

	| selectors |
	selectors := methods keys, self uncheckedAbstractMethods.
	abstractDeclarations do: [:sel |
		(selectors includes: sel)
			ifFalse: [self notify: 'missing implementation for ', sel]]
