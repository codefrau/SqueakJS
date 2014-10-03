utilities
emitBuiltinConstructFor: msgNode on: aStream level: level
	"If the given selector is in the translation dictionary, translate it into a target code construct and return true. Otherwise, do nothing and return false."

	| action |
	action := translationDict at: msgNode selector ifAbsent: [ ^false ].
	self perform: action with: msgNode with: aStream with: level.
	^true