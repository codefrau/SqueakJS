inlining
isSubstitutableNode: aNode
	"Answer true if the given parameter node is either a constant, a local variable, or a formal parameter of the receiver. Such parameter nodes may be substituted directly into the body of the method during inlining. Note that global variables cannot be subsituted because the inlined method might depend on the exact ordering of side effects to the globals."

	aNode isConstant ifTrue: [ ^true ].
	^aNode isVariable and:
		[(locals includes: aNode name) or:
		[args includes: aNode name]]