utilities
removeVariable: aName
	"Remove the given (instance) variable from the code base."
	self checkDeleteVariable: aName.
	variables
		remove: aName
		ifAbsent:
			[(vmClass notNil
			  and: [vmClass isNonArgumentImplicitReceiverVariableName: aName]) ifFalse:
				[logger
					ensureCr;
					show: 'warning, variable '
						, aName
						, ' doesn''t exist or has already been removed';
						cr]].
	variableDeclarations removeKey: aName ifAbsent: []