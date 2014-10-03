inlining
removeAssertions
	"Remove all assertions in method bodies.  This is for the benefit of inlining, which
	fails to recognise and disregard empty method bodies when checking the inlinability
	of sends."

	| newMethods |
	newMethods := Dictionary new.
	'Removing assertions...'
		displayProgressAt: Sensor cursorPoint
		from: 0 to: methods size
		during: [ :bar |
			methods doWithIndex: [ :m :i |
				bar value: i.
				m isAssertion ifFalse: [
					newMethods at: m selector put: m.
					m removeAssertions]]].
	methods := newMethods.