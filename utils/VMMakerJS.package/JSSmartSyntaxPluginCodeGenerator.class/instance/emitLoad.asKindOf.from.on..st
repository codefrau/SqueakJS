linking
emitLoad: aString asKindOf: aClass from: anInteger on: aStream

	self emitLoad: aString asNakedOopFrom: anInteger on: aStream.
	aStream
		crtab;
		nextPutAll: 'interpreterProxy->success(interpreterProxy->isKindOf(';
		nextPutAll: aString;
		nextPutAll: 	', ''';
		nextPutAll:	aClass asString;
		nextPutAll: '''))'