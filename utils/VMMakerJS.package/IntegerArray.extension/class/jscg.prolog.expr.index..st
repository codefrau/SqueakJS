*vmmakerjs
jscg: cg prolog: aBlock expr: aString index: anInteger

	^cg 
		jscgLoad: aBlock 
		expr: aString 
		asIntPtrFrom: anInteger
		andThen: (cg jscgValBlock: 'isWords')