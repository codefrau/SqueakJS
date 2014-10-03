error notification
printUnboundCallWarnings
	"Print a warning message for every unbound method call in the code base."

	| knownSelectors undefinedCalls |
	undefinedCalls := Dictionary new.
	knownSelectors := translationDict keys asSet.
	knownSelectors add: #error:.
	methods do: [ :m | knownSelectors add: m selector ].
	methods do: [ :m |
		m allCalls do: [ :sel |
			(knownSelectors includes: sel) ifFalse: [
				(undefinedCalls includesKey: sel)
					ifTrue: [ (undefinedCalls at: sel) add: m selector ]
					ifFalse: [ undefinedCalls at: sel put: (OrderedCollection with: m selector) ].
			].
		].
	].

	Transcript cr.
	undefinedCalls keys asSortedCollection do: [ :undefined |
		Transcript show: undefined, ' -- undefined method sent by:'; cr.
		(undefinedCalls at: undefined) do: [ :caller |
			Transcript tab; show: caller; cr.
		].
	].