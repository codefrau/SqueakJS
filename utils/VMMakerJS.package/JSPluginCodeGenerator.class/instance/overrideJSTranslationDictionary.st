public
overrideJSTranslationDictionary
	| sel |
	sel := (#translatedMethods, self pluginName) asSymbol.
	(self respondsTo: sel) ifFalse: [^self].
	(self perform: sel) associationsDo: [:assoc |
		translationDict at: assoc key put: assoc value].
