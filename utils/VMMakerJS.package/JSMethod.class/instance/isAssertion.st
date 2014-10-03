testing
isAssertion
	^(selector beginsWith: 'assert') or: [selector beginsWith: 'verify']