JS code generator
emitDefineMemoryAccessInImageOn: aStream
	"If MemoryAccess is present in the image, then define MEMORY_ACCESS_IN_IMAGE as
	a C preprocessor macro. When MEMORY_ACCESS_IN_IMAGE is defined, the traditional
	C preprocessor macros for low level memory access are ignored and will be replaced
	by directly translated (and inlined) SLANG versions of the same. This enables visibility
	of the memory access functions for debuggers and profilers."

	(Smalltalk classNamed: #MemoryAccess)
		ifNotNilDo: [:ma | ma isEnabled
			ifTrue: [aStream nextPutAll: '#define MEMORY_ACCESS_IN_IMAGE 1'; cr]]