instance creation
doesNotUnderstand: aMessage
	"Call a global function, or get a global object"
	<primitive: 117> #(JavaScriptPlugin primitiveDoUnderstand 0 0) at: 1.
	^ self primitiveFailed
