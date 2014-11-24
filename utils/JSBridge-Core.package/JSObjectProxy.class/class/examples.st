class initialization
examples
	| comment |
	"Create symbols in advance"
	('alert: console log: document getElementsByTagName: new:and:body: call:with:and: navigator Object keys: Function length'
		findTokens: ' ') do: [:s | s asSymbol].
	comment := self organization classComment asString.
	^ comment copyFrom: (comment indexOf: $") to: comment size.
