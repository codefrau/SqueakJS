instance creation
at: aString put: anObject
	"set a global"
	<primitive: 117> #(JavaScriptPlugin primitiveAtPut 0 0) at: 1.
	^ self primitiveFailed
