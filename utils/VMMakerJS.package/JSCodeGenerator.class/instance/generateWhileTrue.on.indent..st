JS translation
generateWhileTrue: msgNode on: aStream indent: level
	"Generate C code for a loop in one of the following formats, as appropriate:
		while(cond) { stmtList }
		do {stmtList} while(cond)
		while(true) {stmtListA; if (!(cond)) break; stmtListB}"

	msgNode receiver statements size <= 1
		ifTrue: [^self generateWhileTrueLoop: msgNode on: aStream indent: level].
	msgNode args first isNilStmtListNode
		ifTrue: [^self generateDoWhileTrue: msgNode on: aStream indent: level].
	^self generateWhileForeverBreakFalseLoop: msgNode on: aStream indent: level