JS code generator
emitJSCodeOn: aStream doInlining: inlineFlag doAssertions: assertionFlag
	"Emit C code for all methods in the code base onto the given stream. All inlined method calls should already have been expanded."

	self prepareMethodsInlined: inlineFlag doAssertions: assertionFlag.
	^ self emitJSCodeOn: aStream doAssertions: assertionFlag
