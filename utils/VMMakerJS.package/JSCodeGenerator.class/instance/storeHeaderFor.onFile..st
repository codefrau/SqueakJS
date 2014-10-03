public
storeHeaderFor: interpreterClassName onFile: fileName
	"Store C header code for this interpreter on the given file."

	| aStream |
	aStream := CrLfFileStream forceNewFileNamed: fileName.
	aStream ifNil: [Error signal: 'Could not open C header file: ', fileName].
	aStream
		nextPutAll: '/* ';
		nextPutAll: VMMaker headerNotice;
		nextPutAll: ' */'; cr; cr;
		nextPutAll: '#ifndef HAVE_INTERP_H'; cr;
		nextPutAll: '# define HAVE_INTERP_H'; cr;
		nextPutAll: '#endif'; cr; cr.
	self emitVmmVersionOn: aStream.
	(Smalltalk classNamed: interpreterClassName)
		emitInterpreterProxyVersionOn: aStream.
	self emitDefineBytesPerWordOn: aStream.
	self emitDefineMemoryAccessInImageOn: aStream.
	aStream cr.
	aStream close
