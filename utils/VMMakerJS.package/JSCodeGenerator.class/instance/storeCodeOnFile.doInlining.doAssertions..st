public
storeCodeOnFile: fileName doInlining: inlineFlag doAssertions: assertionFlag
	"Store JS code for this code base on the given file."

	| stream |
	stream := CrLfFileStream forceNewFileNamed: fileName.
	stream ifNil: [Error signal: 'Could not open JS code file: ', fileName].
	self emitJSCodeOn: stream doInlining: inlineFlag doAssertions: assertionFlag.
	stream close