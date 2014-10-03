public
addMethodsForPrimitives: classAndSelectorList 
	| sel aClass source verbose meth |
	classAndSelectorList do:[:classAndSelector | 
		aClass := Smalltalk at: (classAndSelector at: 1) ifAbsent:[nil].
		aClass ifNotNil:[
			self addAllClassVarsFor: aClass.
			"TPR - should pool vars also be added here?"

			"find the method in either the class or the metaclass"
			sel := classAndSelector at: 2.
			(aClass includesSelector: sel)
				ifTrue: [source := aClass sourceCodeAt: sel ifAbsent:[nil]]
				ifFalse: [source := aClass class sourceCodeAt: sel ifAbsent:[nil]].
		].
		source ifNil:[
			Transcript cr; show: 'WARNING: Compiled primitive ', classAndSelector first, '>>', classAndSelector last, ' not present'.
		] ifNotNil:[
			"compile the method source and convert to a suitable translation 
			method "
			meth := (Compiler new
						parse: source
						in: aClass
						notifying: nil)
						asTranslationMethodOfClass: self translationMethodClass.

			(aClass includesSelector: sel)
				ifTrue: [meth definingClass: aClass]
				ifFalse: [meth definingClass: aClass class].
			meth primitive > 0 ifTrue:[meth preparePrimitiveName].
			"for old-style array accessing: 
			meth covertToZeroBasedArrayReferences."
			meth replaceSizeMessages.
			self addMethod: meth.
		].
	].
	"method preparation"
	verbose := false.
	self prepareMethods.
	verbose
		ifTrue: 
			[self printUnboundCallWarnings.
			self printUnboundVariableReferenceWarnings.
			Transcript cr].

	"code generation"
	self doInlining: true.

	methods do:[:m|
		"if this method is supposed to be a primitive (rather than a helper 
		routine), add assorted prolog and epilog items"
		m primitive > 0 ifTrue: [m preparePrimitivePrologue]].