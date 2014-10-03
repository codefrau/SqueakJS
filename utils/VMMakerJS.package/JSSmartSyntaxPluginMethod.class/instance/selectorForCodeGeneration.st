accessing
selectorForCodeGeneration
	"A primitive directive my override the selector specification."

	^ self selectorOverride ifNil: [self selector]