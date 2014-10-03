coercing
jscgTVarBlock: anInteger

	^[:expr | '(thisContext tempAt: 1) tempAt: ', anInteger asString, ' put: (', expr, ')']