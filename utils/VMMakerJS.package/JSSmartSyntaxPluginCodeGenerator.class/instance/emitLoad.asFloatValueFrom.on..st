linking
emitLoad: aString asFloatValueFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: 	' = interpreterProxy->stackFloatValue(';
		nextPutAll: anInteger asString;
		nextPutAll: ')'