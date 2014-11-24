class initialization
initialize
	"Create the JS global"
	Smalltalk at: #JS put: self basicNew.
	"If we have the plugin, show workspace"
	[JS window] ifError: [:err :rcvr | ^self].
	Smalltalk isMorphic
		ifTrue: [self openExamples]
		ifFalse: [[self openExamples] fork].
