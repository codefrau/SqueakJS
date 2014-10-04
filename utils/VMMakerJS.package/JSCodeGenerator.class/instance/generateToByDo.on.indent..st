JS translation
generateToByDo: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	"N.B. MessageNode>>asTranslatorNodeIn: adds the limit var as a hidden fourth argument."
	| blockExpr iterationVar limitExpr mayHaveSideEffects limitVar step negative |
	blockExpr := msgNode args third.
	blockExpr args size = 1 ifFalse:
		[self error: 'wrong number of block arguments'].
	iterationVar := blockExpr args first.
	limitExpr := msgNode args first.
	aStream nextPutAll: 'for (', iterationVar, ' = '.
	self emitJSExpression: msgNode receiver on: aStream.
	mayHaveSideEffects := msgNode args size = 4. "See TMethod>>prepareMethodIn:"
	mayHaveSideEffects ifTrue:
		[limitVar := msgNode args last.
		 aStream nextPutAll: ', ', limitVar name, ' = '.
		 self emitJSExpression: limitExpr on: aStream.
		 limitExpr := limitVar].
	aStream nextPutAll: '; ', iterationVar.
	negative := ((step := msgNode args at: 2) isConstant and: [step value < 0])
				or: [step isSend and: [step selector == #negated
					and: [step receiver isConstant and: [step receiver value >= 0]]]].
	aStream nextPutAll: (negative ifTrue: [' >= '] ifFalse: [' <= ']).
	self emitJSExpression: limitExpr on: aStream.
	(step isConstant and: step value = 1)
		ifTrue: [aStream nextPutAll: '; ', iterationVar, '++']
		ifFalse: [aStream nextPutAll: '; ', iterationVar, ' += '.
			self emitJSExpression: step on: aStream].
	aStream nextPutAll: ') {'; cr.
	blockExpr emitJSCodeOn: aStream level: level + 1 generator: self.
	aStream tab: level.
	aStream nextPut: $}