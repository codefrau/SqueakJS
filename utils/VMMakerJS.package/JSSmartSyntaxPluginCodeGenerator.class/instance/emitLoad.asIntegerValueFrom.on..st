linking
emitLoad: aString asIntegerValueFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: 	' = interpreterProxy stackIntegerValue(';
		nextPutAll: anInteger asString;
		nextPutAll: ')'