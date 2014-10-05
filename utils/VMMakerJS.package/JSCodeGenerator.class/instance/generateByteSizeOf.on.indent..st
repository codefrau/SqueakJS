JS hacks
generateByteSizeOf: msgNode on: aStream indent: level
	aStream nextPutAll: 'BYTESIZEOF('.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: ')'.
