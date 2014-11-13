private
checkNonPointer: node op: op
	self ifPointerVar: node then: [:type |
		self halt: 'cannot do ', op, ' with ', type]