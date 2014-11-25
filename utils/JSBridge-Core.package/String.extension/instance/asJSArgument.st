*jsbridge-core
asJSArgument
	"converted to JS string by plugin"
	self class isBytes ifTrue: [^self].
	^super asJSArgument
