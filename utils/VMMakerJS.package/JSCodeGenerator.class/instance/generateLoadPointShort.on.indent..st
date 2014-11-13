JS hacks
generateLoadPointShort: msgNode on: aStream indent: level
	msgNode args second isVariable ifFalse: [self halt].
	msgNode args second name = 'points' ifFalse: [self halt].
	aStream nextPutAll: '(points.int16Array || (points.int16Array = new Int16Array(points.buffer, points.byteOffset)))['.
	 msgNode args first emitJSCodeAsExpressionOn: aStream level: 0 generator: self.
	aStream nextPutAll: ']'.
