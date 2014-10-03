inlining
pruneUnreachableMethods
	"Remove any methods that are not reachable. Retain methods needed by the translated classes - see implementors of requiredMethodNames"
 	
	| newMethods |
	"add all the exported methods and all the called methods to the dNRML"
	methods do: [ :m |
		m export ifTrue:[doNotRemoveMethodList add: m selector].
		doNotRemoveMethodList addAll: m allCalls].

	"build a new dictionary of methods from the collection of all the ones to keep"			
	newMethods := Dictionary new: doNotRemoveMethodList size.
	doNotRemoveMethodList do:[:sel|
		methods at: sel ifPresent:[:meth| newMethods at: sel put: meth]].
	methods := newMethods