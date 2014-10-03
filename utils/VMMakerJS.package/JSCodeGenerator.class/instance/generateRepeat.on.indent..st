JS translation
generateRepeat: msgNode on: aStream indent: level
	"Generate while(true) { stmtList } "

	aStream nextPutAll: 'while(true) {'; cr.
	msgNode receiver emitJSCodeOn: aStream level: level + 1 generator: self.
	level timesRepeat: [ aStream tab ].
	aStream nextPutAll: '}'
