coercing
jscgSetBlock: aString

	^[:expr | aString, ' := ', expr]