*vmmakerjs
isLeafOrFunc
	selector precedence = 2 ifTrue: [^false].
	(#(and: or: bitAnd: bitOr: bitXor: bitShift:) includes: selector) ifTrue: [^false].
	^true