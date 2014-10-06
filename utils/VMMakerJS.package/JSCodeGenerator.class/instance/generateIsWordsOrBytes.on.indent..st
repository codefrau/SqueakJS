JS hacks
generateIsWordsOrBytes: msgNode on: aStream indent: level
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.isWordsOrBytes()'.
