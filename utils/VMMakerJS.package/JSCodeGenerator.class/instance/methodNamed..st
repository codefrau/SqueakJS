utilities
methodNamed: selector
	"Answer the method in the code base with the given selector."

	^ methods at: selector ifAbsent: [ nil ]