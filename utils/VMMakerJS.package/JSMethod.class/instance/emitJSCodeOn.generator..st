JS code generation
emitJSCodeOn: aStream generator: aCodeGen
	"Emit JS code for this method onto the given stream. All calls to inlined methods should already have been expanded."
	aCodeGen currentMethod: self.
	aCodeGen pushScope: declarations while: [
		self emitJSCommentOn: aStream.	"place method comment before function"
		self emitJSHeaderOn: aStream generator: aCodeGen.
		(self emitJSSpecialOn:  aStream level: 1 generator: aCodeGen)
			ifFalse: [parseTree emitJSCodeOn: aStream level: 1 generator: aCodeGen].
		aStream nextPutAll: '}'; cr]