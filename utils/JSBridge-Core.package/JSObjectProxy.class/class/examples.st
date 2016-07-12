class initialization
examples
	| comment |
	"Create symbols in advance"
	('sqPlus:and: alert: console log: document getElementsByTagName: navigator Object keys: Function length eval: then: setTimeout:ms: createElement: appendChild: jQuery: hide: show: css: click: appendTo:'
		findTokens: ' ') do: [:s | s asSymbol].
	comment := self organization classComment asString.
	^ comment copyFrom: (comment indexOf: $") to: comment size.
