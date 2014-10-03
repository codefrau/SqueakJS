JS code generation
emitJSFunctionHeader: aStream generator: aCodeGen
	"Emit a C function header for this method onto the given stream."

	properties ifNotNil:
		[(properties at: #api: ifAbsent: []) ifNotNil:
			[:pragma|
			aStream nextPutAll: (pragma argumentAt: 1).
			^self]].
	self emitJSFunctionHeader: aStream generator: aCodeGen newlineBeforeName: false