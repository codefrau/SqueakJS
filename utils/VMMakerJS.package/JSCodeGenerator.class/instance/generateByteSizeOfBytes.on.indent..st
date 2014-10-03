JS hacks
generateByteSizeOfBytes: msgNode on: aStream indent: level
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.bytes ? '.
	msgNode args first emitJSCodeOn: aStream level: level generator: self.
	aStream nextPutAll: '.bytes.length : 0'.
