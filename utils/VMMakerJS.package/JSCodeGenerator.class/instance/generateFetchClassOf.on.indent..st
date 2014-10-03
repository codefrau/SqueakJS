JS hacks
generateFetchClassOf: msgNode on: aStream indent: level
	aStream nextPut: $(.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.sqClass ? '.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.sqClass : interpreterProxy.classSmallInteger()'.
	aStream nextPut: $).
