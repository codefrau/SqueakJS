utilities
nodeCount
	"Answer the number of nodes in this method's parseTree (a rough measure of its size)."

	| cnt |
	cnt := 0.
	parseTree nodesDo: [ :n | cnt := cnt + 1 ].
	^cnt