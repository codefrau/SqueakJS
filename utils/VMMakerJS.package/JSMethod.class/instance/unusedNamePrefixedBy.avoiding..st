inlining support
unusedNamePrefixedBy: aString avoiding: usedNames
	"Choose a unique variable or label name with the given string as a prefix, avoiding the names in the given collection. The selected name is added to usedNames."

	| n newVarName |
	n := 1.
	newVarName := aString, n printString.
	[usedNames includes: newVarName] whileTrue: [
		n := n + 1.
		newVarName := aString, n printString.
	].
	usedNames add: newVarName.
	^ newVarName