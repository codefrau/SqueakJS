JS hacks
generateFetchClassOf: msgNode on: aStream indent: level
	aStream nextPutAll: 'CLASSOF('.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPut: $).
