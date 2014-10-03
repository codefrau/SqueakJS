coercing
jscgLoad: aBlock expr: aString asFloatValueFrom: anInteger
	"Answer codestring for double precision coercion (with validating side-effect) of oop, as described in comment to jscgLoad:expr:asRawOopFrom:"

	^aBlock value: (String streamContents: [:aStream | aStream
		nextPutAll: 'interpreterProxy stackFloatValue: ';
		nextPutAll: anInteger asString])