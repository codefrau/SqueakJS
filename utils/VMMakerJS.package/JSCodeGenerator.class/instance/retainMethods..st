inlining
retainMethods: aListOfMethodsToKeep
"add aListOfMethodsToKeep to doNotRemoveMethodList so that they will not be pruned"
	doNotRemoveMethodList ifNil:[doNotRemoveMethodList := Set new:100].
	doNotRemoveMethodList addAll: aListOfMethodsToKeep.
	^aListOfMethodsToKeep