accessing
at: aString put: anObject
	"set a property"
	<primitive: 117> #(JavaScriptPlugin primitiveAtPut 0 0) at: 1.
	^ self primitiveFailed
