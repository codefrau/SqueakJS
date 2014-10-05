JS hacks
generateSlotSizeOf: msgNode on: aStream indent: level
	aStream nextPutAll: 'SLOTSIZEOF('.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPut: $).
