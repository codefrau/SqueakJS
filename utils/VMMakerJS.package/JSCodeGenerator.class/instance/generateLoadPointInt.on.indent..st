JS hacks
generateLoadPointInt: msgNode on: aStream indent: level
	aStream nextPutAll: '('.
	self emitJSExpression: msgNode args second on: aStream. 
	aStream nextPutAll: '['.
	self emitJSExpression: msgNode args first on: aStream. 
	aStream nextPutAll: ']|0)'.
