coercing
jscgLoad: aBlock expr: aString asKindOf: aClass from: anInteger

	^String streamContents: [:aStream | aStream
		nextPutAll: 'interpreterProxy success: (interpreterProxy';
		crtab: 2;
		nextPutAll: 'is: (interpreterProxy stackValue: ';
		nextPutAll: anInteger asString;
		nextPutAll: ')';
		crtab: 2;
		nextPutAll: 	'KindOf: ''';
		nextPutAll:	aClass asString;
		nextPutAll: ''').';
		crtab;
		nextPutAll: (self 
						jscgLoad: aBlock 
						expr: aString 
						asRawOopFrom: anInteger)]