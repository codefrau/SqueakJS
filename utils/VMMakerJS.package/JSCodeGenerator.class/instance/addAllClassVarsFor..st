public
addAllClassVarsFor: aClass
	"Add the class variables for the given class (and its superclasses) to the code base as constants."

	| allClasses |
	allClasses := aClass withAllSuperclasses.
	allClasses do: [:c | self addClassVarsFor: c].
