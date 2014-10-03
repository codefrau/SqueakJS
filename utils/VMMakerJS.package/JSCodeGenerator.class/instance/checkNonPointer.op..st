private
checkNonPointer: node op: op
	node isVariable
		ifTrue: [(self typeOfVariable: node name) ifNotNil: [:type |
			(type includes: $*) ifTrue: [self halt: 'cannot do ', op, ' with ', type]]].