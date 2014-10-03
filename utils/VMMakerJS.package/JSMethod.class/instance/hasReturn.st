testing
hasReturn
	"Answer true if this method contains a return statement."

	parseTree nodesDo: [ :n | n isReturn ifTrue: [ ^ true ]].
	^ false