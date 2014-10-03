inlining support
renameLabelsUsing: aDictionary
	"Rename all labels according to the old->new mappings of the given dictionary."

	labels := labels collect: [ :label |
		(aDictionary includesKey: label) ifTrue: [ aDictionary at: label ] ifFalse: [ label ].
	].

	parseTree nodesDo: [ :node |
		(node isGoTo and: [aDictionary includesKey: node label]) ifTrue: [
			node setLabel: (aDictionary at: node label).
		].
		(node isLabel and: [aDictionary includesKey: node label]) ifTrue: [
			node setLabel: (aDictionary at: node label).
		].
	].