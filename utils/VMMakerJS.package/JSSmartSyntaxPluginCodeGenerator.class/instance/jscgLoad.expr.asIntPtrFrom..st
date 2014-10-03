coercing
jscgLoad: aBlock expr: aString asIntPtrFrom: anInteger
	"Answer codestring for integer pointer to first indexable field of object (without validating side-effect), as described in comment to jscgLoad:expr:asRawOopFrom:"

	^aBlock value: (String streamContents: [:aStream | aStream
		nextPutAll: 'self cCoerce: (interpreterProxy firstIndexableField:';
		crtab: 4;
		nextPutAll: '(interpreterProxy stackValue:';
		nextPutAll: anInteger asString;
		nextPutAll:	'))';
		crtab: 3;
		nextPutAll: 'to: ''int *'''])