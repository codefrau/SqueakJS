accessing
at: aString put: anObject
	"set a property"
	| error |
	<primitive: 117> #(JavaScriptPlugin primitiveAtPut 0 0) at: 1.
	(error := self primGetError) ifNotNil: [
		^ (error beginsWith: 'asJSArgument')
			ifTrue: [self at: aString put: anObject asJSArgument]
			ifFalse: [self error: error]].
	^ self primitiveFailed
