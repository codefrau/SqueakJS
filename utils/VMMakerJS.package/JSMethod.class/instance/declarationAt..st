accessing
declarationAt: aVariableName
	^declarations at: aVariableName ifAbsent: [#sqInt, ' ', aVariableName]