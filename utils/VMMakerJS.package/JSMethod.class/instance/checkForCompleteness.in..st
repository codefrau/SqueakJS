inlining
checkForCompleteness: stmtLists in: aCodeGen
	"Set the complete flag if none of the given statement list nodes contains further candidates for inlining."

	complete := true.
	stmtLists do: [ :stmtList |
		stmtList statements do: [ :node |
			(self inlineableSend: node in: aCodeGen) ifTrue: [
				complete := false.  "more inlining to do"
				^self
			].
		].
	].
	parseTree nodesDo: [ :n |
		(self inlineableFunctionCall: n in: aCodeGen) ifTrue: [
			complete := false.  "more inlining to do"
			^self
		].
	].