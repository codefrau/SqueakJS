accessing
doesNotUnderstand: aMessage
	"Create an instance of self, call a function, or get/set an existing property"
	<primitive: 117>
	#(JavaScriptPlugin primitiveDoUnderstand 0 0).
	^ self primitiveFailed
