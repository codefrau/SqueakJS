inlining support
renameLabelsForInliningInto: destMethod
	"Rename any labels that would clash with those of the destination method."

	| destLabels usedLabels labelMap newLabelName |
	destLabels := destMethod labels asSet.
	usedLabels := destLabels copy.  "usedLabels keeps track of labels in use"
	usedLabels addAll: labels.
	labelMap := Dictionary new: 100.
	self labels do: [ :l |
		(destLabels includes: l) ifTrue: [
			newLabelName := self unusedNamePrefixedBy: 'l' avoiding: usedLabels.
			labelMap at: l put: newLabelName.
		].
	].
	self renameLabelsUsing: labelMap.