inlining
doBasicInlining: inlineFlag
	"Inline the bodies of all methods that are suitable for inlining.
	This method does only the basic inlining suitable for both the core VM and plugins - no bytecode inlining etc"

	| pass progress max |
	inlineFlag ifFalse: [^self].
	self collectInlineList.
	pass := 0.
	max := 12. "More than this is probably due to infinite recursion" 
	progress := true.
	[progress] whileTrue: [
		"repeatedly attempt to inline methods until no further progress is made"
		progress := false.
		pass > max
			ifTrue: [self notify: 'too many inlining steps, inlining terminated']
			ifFalse: [('Inlining pass ', (pass := pass + 1) printString, '...')
						displayProgressAt: Sensor cursorPoint
						from: 0 to: methods size
						during: [:bar |
							(self sortMethods: methods) doWithIndex: [:m :i |
								bar value: i.
								currentMethod := m.
								(m tryToInlineMethodsIn: self)
									ifTrue: [progress := true]]]]].

