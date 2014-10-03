linking
emitLoad: aString asNakedOopFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: ' = interpreterProxy stackValue(';
		nextPutAll: anInteger asString;
		nextPutAll: ')'