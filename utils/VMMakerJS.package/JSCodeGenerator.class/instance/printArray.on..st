private
printArray: array on: aStream
	| first |
	first := true.
	1 to: array size do:
		[:i |
		first 
			ifTrue: [first := false]
			ifFalse: [aStream nextPutAll: ', '].
		i \\ 16 = 1 ifTrue: [aStream cr].
		self printInt: (array at: i) on: aStream]