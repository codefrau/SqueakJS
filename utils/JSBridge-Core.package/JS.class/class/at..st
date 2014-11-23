instance creation
at: aString
	"get a global"
	<primitive: 117> #(JavaScriptPlugin primitiveAt 0 0) at: 1.
	^ self primitiveFailed
