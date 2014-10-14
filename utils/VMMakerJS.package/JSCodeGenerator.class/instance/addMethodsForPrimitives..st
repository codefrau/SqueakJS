public
addMethodsForPrimitives: classAndSelectorList 
	| sel aClass source verbose meth primInstVars sharedInstVars assignedInstVars |
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
	"self doInlining: false"

	primInstVars := Set new.			"inst vars used in primitives"
	sharedInstVars := Set new.			"inst vars used in non-primitives"
	assignedInstVars :=  Set new.		"inst vars modified in non-primitives"
	methods do:[:m|
		m primitive > 0 ifTrue: [
			primInstVars addAll: m freeVariableReferences.
		] ifFalse: [
			sharedInstVars addAll: m freeVariableReferences.
			assignedInstVars addAll: m variablesAssignedTo.
		].
	].
	methods do:[:m|
		"if this method is supposed to be a primitive (rather than a helper 
		routine), add assorted prolog and epilog items"
		m primitive > 0 ifTrue: [
			m preparePrimitivePrologueShared: sharedInstVars assigned: assignedInstVars ].
		"check for one-based array access"	
		m oneBasedArrays ifNotNil: [self oneBasedArrays: true].
	].
	"Add declarations for inst vars used in both prims and non-prims as global"
	((primInstVars intersection: sharedInstVars) difference: variables) do: [:var |
		methods do:[:m|
			m declarations at: var ifPresent: [:decl |
				variableDeclarations at: var
					ifPresent: [:existing |
						decl = existing ifFalse: [self error: 'decls do not match']]
					ifAbsent: [variableDeclarations at: var put: decl]]].
		variables add: var].
	"Add non-shared inst vars as local"
	methods do:[:m|
		m locals addAll: (m freeVariableReferences difference: sharedInstVars)].
	