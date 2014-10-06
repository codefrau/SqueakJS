JS code generator
jsFunctionNameFor: aSelector
	"Create a JS function name from the given selector by omitting colons
	and prefixing with the plugin name if the method is exported."
	^aSelector copyWithout: $: