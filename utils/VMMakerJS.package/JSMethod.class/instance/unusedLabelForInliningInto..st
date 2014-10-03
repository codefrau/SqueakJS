inlining
unusedLabelForInliningInto: targetMethod

	| usedLabels |
	usedLabels := labels asSet.
	usedLabels addAll: targetMethod labels.
	^self unusedNamePrefixedBy: 'l' avoiding: usedLabels