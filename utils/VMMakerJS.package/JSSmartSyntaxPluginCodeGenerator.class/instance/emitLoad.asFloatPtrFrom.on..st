linking
emitLoad: aString asFloatPtrFrom: anInteger on: aStream

	aStream
		nextPutAll: aString;
		nextPutAll: 	' = (float *) interpreterProxy->firstIndexableField(';
		crtab: 2;
		nextPutAll: 	'interpreterProxy->stackValueOf(';
		nextPutAll: anInteger asString;
		nextPutAll: '))'