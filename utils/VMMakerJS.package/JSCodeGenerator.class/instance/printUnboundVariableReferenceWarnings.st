error notification
printUnboundVariableReferenceWarnings
	"Print a warning message for every unbound variable reference in the code base."

	| undefinedRefs globalVars knownVars |
	undefinedRefs := Dictionary new.
	globalVars := Set new: 100.
	globalVars addAll: variables.
	methods do: [ :m |
		knownVars := globalVars copy.
		m args do: [ :var | knownVars add: var ].
		m locals do: [ :var | knownVars add: var ].
		m freeVariableReferences do: [ :varName |
			(knownVars includes: varName) ifFalse: [
				(undefinedRefs includesKey: varName)
					ifTrue: [ (undefinedRefs at: varName) add: m selector ]
					ifFalse: [ undefinedRefs at: varName put: (OrderedCollection with: m selector) ].
			].
		].
	].

	Transcript cr.
	undefinedRefs keys asSortedCollection do: [ :var |
		Transcript show: var, ' -- undefined variable used in:'; cr.
		(undefinedRefs at: var) do: [ :sel |
			Transcript tab; show: sel; cr.
		].
	].