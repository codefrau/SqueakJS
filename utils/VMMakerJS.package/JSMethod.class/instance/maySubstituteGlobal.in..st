inlining support
maySubstituteGlobal: globalVar in: aCodeGen
	"Answer true if this method does or may have side effects on the given global variable."

	possibleSideEffectsCache = nil ifTrue: [
		"see if this calls any other method and record the result"
		possibleSideEffectsCache := self computePossibleSideEffectsIn: aCodeGen.
	].
	possibleSideEffectsCache ifTrue: [ ^ false ].

	parseTree nodesDo: [ :node |
		node isAssignment ifTrue: [
			node variable name = globalVar ifTrue: [ ^ false ].
		].
	].

	"if we get here, receiver calls no other method
	 and does not itself assign to the given global variable"
	^ true