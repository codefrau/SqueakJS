public
initialize
	translationDict := Dictionary new.
	inlineList := Array new.
	constants := Dictionary new: 100.
	variables := OrderedCollection new: 100.
	variableDeclarations := Dictionary new: 100.
	methods := Dictionary new: 500.
	macros := Dictionary new.
	self initializeJSTranslationDictionary.
	receiverDict := Dictionary new.
	headerFiles := OrderedCollection new.
	globalVariableUsage := Dictionary new.
	useSymbolicConstants := true.
	generateDeadCode := false.
	scopeStack := OrderedCollection new.
	logger := (ProvideAnswerNotification new tag: #logger; signal) ifNil: [Transcript].
	pools := IdentitySet new.
	abstractDeclarations := IdentitySet new.
	uncheckedAbstractMethods := OrderedCollection new.
