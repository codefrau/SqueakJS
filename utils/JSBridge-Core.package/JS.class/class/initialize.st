class initialization
initialize
	"If we have the plugin, show workspace"
	[JS window] ifError: [:err :rcvr | ^self].
	Smalltalk isMorphic
		ifTrue: [self jsWorkspaceOpen]
		ifFalse: [[self jsWorkspaceOpen] fork].
