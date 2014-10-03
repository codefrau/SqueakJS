inlining
tryToInlineMethodsIn: aCodeGen
	"Expand any (complete) inline methods called by this method. Set the complete bit when all inlining has been done. Return true if something was inlined."

	| stmtLists didSomething newStatements inlinedStmts sendsToInline |
	didSomething := false.

	sendsToInline := Dictionary new: 100.
	parseTree nodesDo: [ :n |
		(self inlineableFunctionCall: n in: aCodeGen) ifTrue: [
			sendsToInline at: n put: (self inlineFunctionCall: n in: aCodeGen).
		].
	].
	sendsToInline isEmpty ifFalse: [
		didSomething := true.
		parseTree := parseTree replaceNodesIn: sendsToInline.
	].

	didSomething ifTrue: [
		possibleSideEffectsCache := nil.
		^didSomething
	].

	stmtLists := self statementsListsForInlining.
	stmtLists do: [ :stmtList | 
		newStatements := OrderedCollection new: 100.
		stmtList statements do: [ :stmt |
			inlinedStmts := self inlineCodeOrNilForStatement: stmt in: aCodeGen.
			(inlinedStmts = nil) ifTrue: [
				newStatements addLast: stmt.
			] ifFalse: [
				didSomething := true.
				newStatements addAllLast: inlinedStmts.
			].
		].
		stmtList setStatements: newStatements asArray.
	].

	didSomething ifTrue: [
		possibleSideEffectsCache := nil.
		^didSomething
	].

	complete ifFalse: [
		self checkForCompleteness: stmtLists in: aCodeGen.
		complete ifTrue: [ didSomething := true ].  "marking a method complete is progress"
	].
	^didSomething