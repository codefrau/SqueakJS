JS translation
generateCCoercion: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| expr |.
	expr := msgNode args first.
	(expr isSend and: [expr receiver name = 'interpreterProxy' and: [expr selector = #firstIndexableField:]]) ifTrue: [
		| cType |
		cType := msgNode args second.
		cType value = 'unsigned char *' ifTrue: [
			self emitJSExpression: expr args first on: aStream.
			^aStream nextPutAll: '.bytes'.
		].
		self halt.
	] ifFalse: [
		self halt.
		self emitJSExpression: expr on: aStream.
	]
