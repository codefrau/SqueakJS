accessing
at: aString
	"get a property"
	<primitive: 117> #(JavaScriptPlugin primitiveAt 0 0) at: 1.
	^ self primitiveFailed
