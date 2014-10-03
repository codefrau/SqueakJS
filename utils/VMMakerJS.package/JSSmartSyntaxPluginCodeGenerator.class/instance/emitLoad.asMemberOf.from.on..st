linking
emitLoad: aString asMemberOf: aClass from: anInteger on: aStream

	self emitLoad: aString asNakedOopFrom: anInteger on: aStream.
	aStream
		crtab;
		nextPutAll: 'interpreterProxy->success(interpreterProxy->isMemberOf(';
		nextPutAll: aString;
		nextPutAll: 	', ''';
		nextPutAll:	aClass asString;
		nextPutAll: '''))'