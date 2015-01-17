*jsbridge-core
asJSArgument
	"converted to JS object by plugin"
	| assocs i |
	assocs := Array new: self size.
	i := 0.
	self associationsDo: [:a |
		assocs at: (i := i + 1) put: a key asJSArgument -> a value asJSArgument].
	^ assocs
