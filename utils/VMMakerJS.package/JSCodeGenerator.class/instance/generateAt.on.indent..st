JS translation
generateAt: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| arrayNode indexNode subtractOne complex |
	arrayNode := msgNode receiver.
	indexNode := msgNode args first.
	subtractOne := self isOneBasedArray: arrayNode name in: currentMethod.
	(subtractOne and: [indexNode isPlusOne]) ifTrue: [
		subtractOne := false.
		indexNode := indexNode receiver.	"remove + 1"
	].
	complex := subtractOne and: [indexNode isLeaf not].
	self emitJSExpression: arrayNode on: aStream.
	aStream nextPut: $[.
	complex ifTrue: [aStream nextPut: $(].
	indexNode emitJSCodeAsExpressionOn: aStream level: level + 1 generator: self.
	complex ifTrue: [aStream nextPut: $)].
	subtractOne ifTrue: [aStream nextPutAll: ' - 1'].
	aStream nextPut: $].