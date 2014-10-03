linking
emitLoad: aString asBooleanValueFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: ' = interpreterProxy->booleanValueOf(';
		crtab: 2;
		nextPutAll: 'interpreterProxy->stackValue(';
		nextPutAll: anInteger asString;
		nextPutAll: '))'