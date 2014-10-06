JS hacks
generateLong32At: msgNode on: aStream indent: level
	| expr index |
	expr := msgNode args first.
	(expr isSend and: [expr selector = #+]) ifFalse: [self halt].
	expr receiver emitJSCodeOn: aStream level: level generator: self.
	index := expr args first.
	aStream nextPut: $[.
	index isTimesFour
		ifTrue: [index receiver emitJSCodeOn: aStream level: level generator: self]
		ifFalse: [
			index emitJSCodeAsExpressionOn: aStream level: level generator: self.
			aStream nextPutAll: ' >>> 2'].
	aStream nextPut: $].
