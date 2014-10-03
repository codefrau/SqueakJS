inlining
inlineFunctionCall: aSendNode in: aCodeGen
	"Answer the body of the called function, substituting the actual parameters for the formal argument variables in the method body."
	"Assume caller has established that:
		1. the method arguments are all substitutable nodes, and
		2. the method to be inlined contains no additional embedded returns."

	| sel meth substitutionDict |
	sel := aSendNode selector.
	meth := (aCodeGen methodNamed: sel) copy.
	meth renameVarsForInliningInto: self in: aCodeGen.
	meth renameLabelsForInliningInto: self.
	self addVarsDeclarationsAndLabelsOf: meth.
	substitutionDict := Dictionary new: 100.
	meth args with: aSendNode args do: [ :argName :exprNode |
		substitutionDict at: argName put: exprNode.
		locals remove: argName.
		declarations removeKey: argName ifAbsent: []].
	meth parseTree bindVariablesIn: substitutionDict.
	^ meth statements first expression