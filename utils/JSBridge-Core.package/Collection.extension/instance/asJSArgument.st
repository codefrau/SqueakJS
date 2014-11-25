*jsbridge-core
asJSArgument
	"converted to JS array by plugin"
	| array i |
	array := Array new: self size.
	i := 0.
	self do: [:each | array at: (i := i + 1) put: each asJSArgument].
	^ array
