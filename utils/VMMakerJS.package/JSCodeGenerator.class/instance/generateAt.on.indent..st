JS translation
generateAt: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| arrayNode indexNode subtractOne complex coerceTo |
	arrayNode := msgNode receiver.
	(arrayNode isSend and: [arrayNode selector = #cCoerce:to: and: [arrayNode args first isVariable]]) ifTrue: [
		coerceTo := (arrayNode args second value) copyWithout: $ .
		arrayNode := arrayNode args first.
		aStream nextPutAll: '('].
	indexNode := msgNode args first.
	subtractOne := self isOneBasedArray: arrayNode name in: currentMethod.
	(subtractOne and: [indexNode isPlusOne]) ifTrue: [
		subtractOne := false.
		indexNode := indexNode receiver.	"remove + 1"
	].
	complex := subtractOne and: [indexNode isLeafOrFunc not].
	self emitJSExpression: arrayNode on: aStream.
	aStream nextPut: $[.
	complex ifTrue: [aStream nextPut: $(].
	indexNode emitJSCodeAsExpressionOn: aStream level: level + 1 generator: self.
	complex ifTrue: [aStream nextPut: $)].
	subtractOne ifTrue: [aStream nextPutAll: ' - 1'].
	aStream nextPut: $].
	coerceTo ifNotNil: [
		coerceTo = 'int*' ifFalse: [self halt].
		aStream nextPutAll: '|0)'].
