JS hacks
generateInterpreterProxyCall: msgNode on: aStream indent: level
	aStream nextPutAll: 'interpreterProxy.'.
	^ msgNode emitJSCodeAsFunctionCallOn: aStream level: level generator: self