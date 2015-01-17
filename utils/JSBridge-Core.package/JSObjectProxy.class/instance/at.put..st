accessing
at: aKey put: aValue
	"set a property"
	| error |
	<primitive: 117> #(JavaScriptPlugin primitiveAtPut 0 0) at: 1.
	^ self with: aValue retry: [:val | self at: aKey put: val]
