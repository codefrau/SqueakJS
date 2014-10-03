coercing
jscgLoad: aBlock expr: aString asBooleanValueFrom: anInteger
	"Answer codestring for boolean coercion (with validating side-effect) of object, as described in comment to jscgLoad:expr:asRawOopFrom:"

	^aBlock value: (String streamContents: [:aStream | aStream
		nextPutAll: 'interpreterProxy booleanValueOf:';
		crtab: 2;
		nextPutAll: '(interpreterProxy stackValue:';
		nextPutAll: anInteger asString;
		nextPutAll:	')'])