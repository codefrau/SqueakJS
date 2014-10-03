coercing
jscgLoad: aBlock expr: aString asUnsignedValueFrom: anInteger
	"Answer a codestring for positive integer coercion (with validating side-effect) of oop, as described in comment to jscgLoad:expr:asRawOopFrom:"

	^aBlock value: (String streamContents: [:aStream | aStream
		nextPutAll: 'interpreterProxy positive32BitValueOf:';
		crtab: 2;
		nextPutAll: '(interpreterProxy stackValue:';
		nextPutAll: anInteger asString;
		nextPutAll:	')'])