linking
emitLoad: aString asNonIntegerValueFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: 	' = interpreterProxy stackObjectValue(';
		nextPutAll: anInteger asString;
		nextPutAll: ')'