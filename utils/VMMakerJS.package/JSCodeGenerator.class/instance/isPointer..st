private
isPointer: node
	self ifPointerVar: node then: [:type | ^true].
	^false