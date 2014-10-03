JS translation
generateWhileFalseLoop: msgNode on: aStream indent: level
	"Generate while(!(cond)) {stmtList}."

	aStream nextPutAll: 'while (!('.
	self emitJSTestBlock: msgNode receiver on: aStream.
	aStream nextPutAll: ')) {'; cr.
	msgNode args first isNilStmtListNode ifFalse:
		[msgNode args first emitJSCodeOn: aStream level: level + 1 generator: self].
	level timesRepeat: [ aStream tab ].
	aStream nextPutAll: '}'.