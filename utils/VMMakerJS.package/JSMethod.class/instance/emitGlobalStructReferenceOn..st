JS code generation
emitGlobalStructReferenceOn: aStream
	"Add a reference to the globals struct if needed"

	(self globalStructureBuildMethodHasFoo > 1)
		ifTrue: [aStream nextPutAll: 'var foo = fum;'; cr].
