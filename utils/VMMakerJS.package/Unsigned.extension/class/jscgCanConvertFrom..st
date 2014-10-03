*vmmakerjs
jscgCanConvertFrom: anObject

	anObject isInteger ifFalse: 
		[self error: 'Not an Integer object'. ^false].
	anObject >= 0 ifFalse: 
		[self error: 'Object is negative integer'. ^false].
	anObject < (2 raisedToInteger: 32) ifFalse: 
		[self error: 'Object is too large'. ^false].
	^true