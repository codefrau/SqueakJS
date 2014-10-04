JS hacks
generateIdentityUnary: msgNode on: aStream indent: level
	"ignore this send, just use its value"
	msgNode receiver emitJSCodeOn: aStream level: level generator: self.
