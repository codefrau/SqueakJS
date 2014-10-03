JS code generator
needToGenerateHeader: headerName file: interpHdrPath contents: newContentsArg
	"Check if we need to regenerate a header file.  We always need to if the contents have changed.
	 But if not we can avoid needless recompilations by not regenerating.  So only regenerate if the
	 package is clean (version doesn't include a '*').  If we can't find a package version ask the user."
	| newContents oldContents |
	(FileDirectory default fileExists: interpHdrPath) ifFalse:
		[^true].
	newContents := newContentsArg.
	oldContents := (FileDirectory default oldFileNamed: interpHdrPath) contentsOfEntireFile.
	(newContents beginsWith: '/*') = (oldContents beginsWith: '/*') ifFalse:
		[(newContents beginsWith: '/*') ifTrue:
			[newContents := newContents readStream upToAll: '*/'; skipSeparators; upToEnd].
		 (oldContents beginsWith: '/*') ifTrue:
			[oldContents := oldContents readStream upToAll: '*/'; skipSeparators; upToEnd]].
	oldContents := oldContents copyReplaceAll: {Character cr. Character lf} with: {Character cr}.
	oldContents replaceAll: Character lf with: Character cr.
	^oldContents ~= newContents
	 or: [[((self monticelloDescriptionFor: vmClass) includes: $*) not]
			on: Error
			do: [:ex|
				self confirm: headerName, ' contents are unchanged.\Writing the file may cause recompilation of support files.\Do you want to write the header file?\The interpreter will still be written either way.' withCRs]]