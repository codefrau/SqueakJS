linking
emitLoad: aString asIntPtrFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: 	' = (int *) interpreterProxy->firstIndexableField(';
		crtab: 2;
		nextPutAll: 	'interpreterProxy->stackValueOf(';
		nextPutAll: anInteger asString;
		nextPutAll: '))'