linking
emitLoad: aString asCharPtrFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: 	' = (char *) interpreterProxy->firstIndexableField(';
		crtab: 2;
		nextPutAll: 	'interpreterProxy->stackValueOf(';
		nextPutAll: anInteger asString;
		nextPutAll: '))'