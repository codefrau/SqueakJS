accessing
at: aKey
	"get a property"
	| error |
	<primitive: 117> #(JavaScriptPlugin primitiveAt 0 0) at: 1.
	(error := self primGetError)
		ifNotNil: [^ self error: error].
	^ self primitiveFailed
