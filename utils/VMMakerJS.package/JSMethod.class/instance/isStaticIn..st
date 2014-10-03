accessing
isStaticIn: aCodeGen
	"If static has been explicitly set, honor that setting. Otherwise defer
	to the code generator for a default setting."
	^static ifNil: [aCodeGen declareMethodsStatic]