JS hacks
generateSlotSizeOf: msgNode on: aStream indent: level
	aStream nextPut: $(.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.bytes ? '.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.bytes.length : '.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.words ? '.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.words.length : interpreterProxy.'.
	msgNode emitJSCodeAsFunctionCallOn: aStream level: level generator: self.
	aStream nextPut: $).
