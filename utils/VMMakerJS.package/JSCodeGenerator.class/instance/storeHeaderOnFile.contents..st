public
storeHeaderOnFile: fileName contents: contents
	"Store C header code on the given file. Evaluate
	 aBlock with the stream to generate its contents."

	| aStream |
	aStream := VMMaker forceNewFileNamed: fileName.
	aStream ifNil: [Error signal: 'Could not open C header file: ', fileName].
	[(contents beginsWith: '/* Automatic') ifFalse:
		[aStream nextPutAll: (self fileHeaderVersionStampForSourceClass: nil); cr].
	 aStream nextPutAll: contents]
		ensure: [aStream close]