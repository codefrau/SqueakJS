primitive compilation
preparePrimitiveName
	"Prepare the selector for this method in translation"
	| aClass |
	aClass := definingClass.
	primitive = 117 
		ifTrue:[selector := ((aClass includesSelector: selector)
					ifTrue: [aClass compiledMethodAt: selector]
					ifFalse: [aClass class compiledMethodAt: selector]) literals first at: 2.
				export := true]
		ifFalse:[selector := 'prim', aClass name, selector].

