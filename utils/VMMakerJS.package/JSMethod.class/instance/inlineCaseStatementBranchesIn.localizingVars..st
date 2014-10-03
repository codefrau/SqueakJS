inlining
inlineCaseStatementBranchesIn: aCodeGen localizingVars: varsList

	| stmt sel meth newStatements maxTemp usedVars exitLabel v |
	maxTemp := 0.
	parseTree nodesDo: [ :n |
		n isCaseStmt ifTrue: [
			n cases do: [ :stmtNode |
				stmt := stmtNode statements first.
				stmt isSend ifTrue: [
					sel := stmt selector.
					meth := aCodeGen methodNamed: sel.
					"Note, original version of this method tested for #hasNoCCode. Removed
					the test to permit inlining methods that may contain automatically
					generated C code for type conversions. -dtl"
					((meth ~= nil) and:
					 [meth args size = 0]) ifTrue: [
						meth := meth copy.
						meth hasReturn ifTrue: [
							exitLabel := self unusedLabelForInliningInto: self.
							meth exitVar: nil label: exitLabel.
							labels add: exitLabel.
						] ifFalse: [ exitLabel := nil ].

						meth renameLabelsForInliningInto: self.
						meth labels do: [ :label | labels add: label ].
						newStatements := stmtNode statements asOrderedCollection.
						newStatements removeFirst.

						exitLabel ~= nil ifTrue: [
							newStatements addFirst:
								(TLabeledCommentNode new
									setLabel: exitLabel comment: 'end case').
						].

						newStatements addFirst: meth asInlineNode.
						newStatements addFirst:
							(TLabeledCommentNode new setComment: meth selector).
						stmtNode setStatements: newStatements.
					].
				].
			].
		].
	].
	usedVars := (locals, args) asSet.
	1 to: maxTemp do: [ :i |
		v := ('t', i printString).
		(usedVars includes: v) ifTrue: [ self error: 'temp variable name conflicts with an existing local or arg' ].
		locals addLast: v.
	].

	"make local versions of the given globals"
	varsList do: [ :var |
		(usedVars includes: var) ifFalse: [ locals addFirst: var asString ].
	].
