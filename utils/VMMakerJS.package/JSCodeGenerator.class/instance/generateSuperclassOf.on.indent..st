JS hacks
generateSuperclassOf: msgNode on: aStream indent: level
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.superclass()'.
