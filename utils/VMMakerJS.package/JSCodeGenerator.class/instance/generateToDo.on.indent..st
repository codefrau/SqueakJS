JS translation
generateToDo: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	| iterationVar |
	(msgNode args last args size = 1) ifFalse: [
		self error: 'wrong number of block arguments'.
	].
	iterationVar := msgNode args last args first.
	aStream nextPutAll: 'for (', iterationVar, ' = '.
	self emitJSExpression: msgNode receiver on: aStream.
	aStream nextPutAll: '; ', iterationVar, ' <= '.
	self emitJSExpression: msgNode args first on: aStream.
	aStream nextPutAll: '; ', iterationVar, '++) {'; cr.
	msgNode args last emitJSCodeOn: aStream level: level + 1 generator: self.
	level timesRepeat: [ aStream tab ].
	aStream nextPutAll: '}'.