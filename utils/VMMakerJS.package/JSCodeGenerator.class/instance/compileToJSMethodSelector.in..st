utilities
compileToJSMethodSelector: selector in: aClass
	"Compile a method to a JSMethod"

	^(Compiler new
		parse: (aClass sourceCodeAt: selector)
		in: aClass
		notifying: nil)
			asTranslationMethodOfClass: self translationMethodClass