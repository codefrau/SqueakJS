accessing
doesNotUnderstand: aMessage
	"Call a function, or get/set an existing property. The function name / property name is the message selector up to the first colon. If the function name is 'new', create a new instance and call the constructor with args."
	| error |
	<primitive: 117> #(JavaScriptPlugin primitiveDoUnderstand 0 0) at: 1.
	(error := self primGetError) ifNotNil: [
		^ (error beginsWith: 'asJSArgument')
			ifTrue: [self perform: aMessage selector
				withArguments: aMessage arguments asJSArgument]
			ifFalse: [self error: error]].
	^ self primitiveFailed
