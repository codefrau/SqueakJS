private
isPointer: node
	node isVariable ifFalse: [^false].
	(self typeOfVariable: node name) ifNotNil: [:type | ^type includes: $*].
	^false