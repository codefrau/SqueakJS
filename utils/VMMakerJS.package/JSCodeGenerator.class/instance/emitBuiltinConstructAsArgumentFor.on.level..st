utilities
emitBuiltinConstructAsArgumentFor: msgNode on: aStream level: level
	"If the given selector is in the translation dictionary, translate it into a target code construct and return true. Otherwise, do nothing and return false."

	| action |
	action := asArgumentTranslationDict
				at: msgNode selector
				ifAbsent: [translationDict at: msgNode selector ifAbsent: [ ^false ]].
	self perform: action with: msgNode with: aStream with: level.
	^true