private
generateFailureGuardOn: sStream
	suppressingFailureGuards ifTrue: [^nil].
	sStream nextPutAll: self checkSuccessExpr
