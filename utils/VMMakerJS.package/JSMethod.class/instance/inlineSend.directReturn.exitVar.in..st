inlining
inlineSend: aSendNode directReturn: directReturn exitVar: exitVar in: aCodeGen
	"Answer a collection of statments to replace the given send. directReturn indicates that the send is the expression of a return statement, so returns can be left in the body of the inlined method. If exitVar is nil, the value returned by the send is not used; thus, returns need not assign to the output variable."

	| sel meth exitLabel labelUsed inlineStmts |
	sel := aSendNode selector.
	meth := (aCodeGen methodNamed: sel) copy.
	meth renameVarsForInliningInto: self in: aCodeGen.
	meth renameLabelsForInliningInto: self.
	self addVarsDeclarationsAndLabelsOf: meth.
	meth hasReturn ifTrue: [
		directReturn ifTrue: [
			"propagate the return type, if necessary"
			returnType = meth returnType ifFalse: [ self halt ].  "caller's return type should be declared by user"
			returnType := meth returnType.
		] ifFalse: [
			exitLabel := self unusedLabelForInliningInto: self.
			labelUsed := meth exitVar: exitVar label: exitLabel.
			labelUsed
				ifTrue: [ labels add: exitLabel ]
				ifFalse: [ exitLabel := nil ].
		].
		"propagate type info if necessary"
		((exitVar ~= nil) and: [meth returnType ~= 'sqInt']) ifTrue: [
			declarations at: exitVar put: meth returnType, ' ', exitVar.
		].
	].
	inlineStmts := OrderedCollection new: 100.
	inlineStmts add: (TLabeledCommentNode new setComment: 'begin ', sel).
	inlineStmts addAll:
		(self argAssignmentsFor: meth args: aSendNode args in: aCodeGen).
	inlineStmts addAll: meth statements.  "method body"
	(directReturn and: [meth endsWithReturn not]) ifTrue: [
		inlineStmts add: (TReturnNode new setExpression: (TVariableNode new setName: 'nil')).
	].
	exitLabel ~= nil ifTrue: [
		inlineStmts add:
			(TLabeledCommentNode new
				setLabel: exitLabel comment: 'end ', meth selector).
	].
	^inlineStmts