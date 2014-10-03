public
addClass: aClass
	"Add the variables and methods of the given class to the code base."

	aClass prepareToBeAddedToCodeGenerator: self.
	self checkClassForNameConflicts: aClass.
	self addClassVarsFor: aClass.
	"ikp..."
	self addPoolVarsFor: aClass.
	variables addAll: aClass instVarNames.
	self retainMethods: aClass requiredMethodNames.

	"The identity of the translated class is kept in vmClass for use in identifying the
	translated source. Unless otherwise overridden, the first class to be added to the
	code generator will provide this identifier."
	vmClass ifNil: [self vmClass: aClass].
	'Adding Class ' , aClass name , '...'
		displayProgressAt: Sensor cursorPoint
		from: 0
		to: aClass selectors size
		during:
			[:bar |
			 aClass selectors doWithIndex: [:sel :i |
				bar value: i.
				self addMethodFor: aClass selector: sel]].
	aClass declareCVarsIn: self