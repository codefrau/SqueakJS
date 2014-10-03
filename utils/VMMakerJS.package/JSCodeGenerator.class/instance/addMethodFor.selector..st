utilities
addMethodFor: aClass selector: selector
	"Add the given method to the code base and answer its translation
	 or nil if it shouldn't be translated."

	| method tmethod |
	method := aClass compiledMethodAt: selector.
	method requiresConcreteImplementation ifTrue: [abstractDeclarations add: selector].
	method isAbstract ifTrue: [^nil].
	(method pragmaAt: #doNotGenerate) ifNotNil: [^nil].
	"process optional methods by interpreting the argument to the option: pragma as either
	 a Cogit class name or a class variable name or a variable name in VMBasicConstants."
	(method pragmaAt: #option:) ifNotNil:
		[:pragma| | key |
		key := pragma argumentAt: 1.
		"((Cogit withAllSubclasses anySatisfy: [:c| c name = key])
		and: [VMClass getVMMaker cogitClassName ~= key]) ifTrue:
			[^nil]."
		(aClass bindingOf: key) ifNotNil:
			[:binding|
			binding value ifFalse: [^nil]].
		(VMBasicConstants bindingOf: key) ifNotNil:
			[:binding|
			binding value ifFalse: [^nil]]].
	tmethod := self compileToJSMethodSelector: selector in: aClass.
	tmethod hasDoNotGenerateStatement ifTrue: [^nil].
	self addMethod: tmethod.
	"If the method has a macro then add the macro.  But keep the method
	 for analysis purposes (e.g. its variable accesses)."
	(method pragmaAt: #cmacro:) ifNotNil:
		[:pragma|
		self addMacro: (pragma argumentAt: 1) for: selector].
	(method propertyValueAt: #cmacro:) ifNotNil:
		[:macro|
		self addMacro: macro for: selector].
	^tmethod