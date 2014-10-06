JS hacks
generateSrcLongAt: msgNode on: aStream indent: level
	aStream nextPutAll: 'sourceBits['.
	msgNode args first emitJSCodeAsExpressionOn: aStream level: level generator: self.
	aStream nextPutAll: ' >>> 2]'.
	
