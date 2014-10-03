utilities
unreachableMethods
	"Return a collection of methods that are never invoked."

	| sent out |
	sent := Set new.
	methods do: [ :m |
		m export ifTrue:[sent add: m selector].
		sent addAll: m allCalls.
	].

	out := OrderedCollection new.
	methods keys do: [ :sel |
		(sent includes: sel) ifFalse: [ out add: sel ].
	].
	^ out