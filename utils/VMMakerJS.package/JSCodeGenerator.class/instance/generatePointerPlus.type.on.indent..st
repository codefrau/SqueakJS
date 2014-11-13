JS translation
generatePointerPlus: msgNode type: type on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	(#('B2DPlugin' 'GeniePlugin') includes: self pluginName) ifFalse: [self halt].
	msgNode emitJSPointerArithmetic: type on: aStream level: level generator: self type: type top: true.
	^true
