*vmmakerjs
isTimesFour
	^self args first isConstant and:
		[(self selector = #* and: [self args first value = 4])
		or: [self selector = #<< and: [self args first value = 2]]]