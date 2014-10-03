coercing
jscgLoad: aBlock expr: aString asWBIntPtrFrom: anInteger
	"Answer codestring for integer pointer to first indexable field of object (with validating side-effect), as described in comment to jscgLoad:expr:asRawOopFrom:"

	^aBlock value: (String streamContents: [:aStream | aStream
		nextPutAll: 'self cCoerce: (interpreterProxy arrayValueOf:';
		crtab: 4;
		nextPutAll: '(interpreterProxy stackValue:';
		nextPutAll: anInteger asString;
		nextPutAll:	'))';
		crtab: 3;
		nextPutAll: 'to: ''int *'''])