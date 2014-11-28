accessing
doesNotUnderstand: aMessage
	"Call a function, or get/set an existing property. The function name / property name is the message selector up to the first colon. If the function name is 'new', create a new instance and call the constructor with args."
	<primitive: 117> #(JavaScriptPlugin primitiveDoUnderstand 0 0) at: 1.
	^self with: aMessage arguments retry: [:args |
		self doesNotUnderstand: (Message selector: aMessage selector arguments: args)]
