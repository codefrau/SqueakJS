private
printInt: int on: aStream
	aStream print: int.
	(int between: -2147483648 and: 2147483647)
		ifFalse: [(int between: 2147483648 and: 4294967295)
			ifTrue: [aStream nextPut: $U]
			ifFalse: [aStream nextPut: $L]]