*vmmakerjs
jscg: cg prolog: aBlock expr: aString index: anInteger

	^cg 
		jscgLoad: aBlock 
		expr: aString 
		asUnsignedPtrFrom: anInteger
		andThen: (cg jscgValBlock: 'isWords')