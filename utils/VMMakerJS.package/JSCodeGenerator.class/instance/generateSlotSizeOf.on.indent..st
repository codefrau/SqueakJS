JS hacks
generateSlotSizeOf: msgNode on: aStream indent: level
	aStream nextPutAll: 'SIZEOF('.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPut: $).
