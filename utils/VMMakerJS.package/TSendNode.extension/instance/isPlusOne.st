*vmmakerjs
isPlusOne
	^ self selector = #+ and: [self args first isConstant and: [self args first value = 1]]