coercing
jscgLoad: aBlock expr: aString asIntegerValueFrom: anInteger
	"Answer codestring for integer coercion (with validating side-effect) of oop, as described in comment to jscgLoad:expr:asRawOopFrom:"

	^aBlock value: (String streamContents: [:aStream | aStream
		nextPutAll: 'interpreterProxy stackIntegerValue: ';
		nextPutAll: anInteger asString])