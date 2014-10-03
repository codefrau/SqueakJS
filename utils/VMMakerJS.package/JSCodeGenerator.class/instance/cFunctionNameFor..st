JS code generator
cFunctionNameFor: aSelector
	"Create a C function name from the given selector by omitting colons
	and prefixing with the plugin name if the method is exported."
	^aSelector copyWithout: $: