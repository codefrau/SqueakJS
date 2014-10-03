inlining support
computePossibleSideEffectsIn: aCodeGen
	"Answer true if this method may have side effects. It has side effects if it assigns to a global variable. It may have side effects if it calls a non-built-in method."

	parseTree nodesDo: [ :node |
		node isSend ifTrue: [
			node isBuiltinOperator ifFalse: [ ^true ].
		].
	].
	^ false