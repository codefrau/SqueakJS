utilities
hasNoCCode
	"Answer true if the receiver does not use inlined C or C declarations, which are not currently renamed properly by the the inliner."

	declarations isEmpty ifFalse: [ ^ false ].

	parseTree nodesDo: [ :node |
		node isSend ifTrue: [
			node selector = #cCode: ifTrue: [ ^ false ].
		].
	].
	^ true