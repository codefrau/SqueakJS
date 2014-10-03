coercing
jscgValBlock: valString
	^[:index | String streamContents:
		[:aStream | aStream
			nextPutAll: 'interpreterProxy success: (interpreterProxy ';
			nextPutAll: valString;
			nextPutAll: ': (interpreterProxy stackValue: ';
			nextPutAll: index asString;
			nextPutAll: '))']]