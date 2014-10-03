coercing
jscgLoad: aBlock expr: aString asUnsignedPtrFrom: anInteger andThen: valBlock
	"Answer a codestring for integer pointer to first indexable field of object (without validating side-effect unless specified in valBlock), as described in comment to jscgLoad:expr:asRawOopFrom:"

	^(valBlock value: anInteger), '.',
	 (aBlock value: (String streamContents: [:aStream | aStream
		nextPutAll: 'self cCoerce: (interpreterProxy firstIndexableField:';
		crtab: 4;
		nextPutAll: '(interpreterProxy stackValue:';
		nextPutAll: anInteger asString;
		nextPutAll:	'))';
		crtab: 3;
		nextPutAll: 'to: ''unsigned *''']))