JS code generation
emitJSCodeOn: aStream generator: aCodeGen
	"Emit JS code for this method onto the given stream. All calls to inlined methods should already have been expanded."
	aCodeGen currentMethod: self.
	aCodeGen pushScope: declarations while: [
		self emitJSCommentOn: aStream.	"place method comment before function"
		self emitJSHeaderOn: aStream generator: aCodeGen.
		parseTree emitJSCodeOn: aStream level: 1 generator: aCodeGen.
		aStream nextPutAll: '}'; cr]