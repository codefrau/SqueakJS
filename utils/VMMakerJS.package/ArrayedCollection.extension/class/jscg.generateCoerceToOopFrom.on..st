*vmmakerjs
jscg: cg generateCoerceToOopFrom: aNode on: aStream
	"N.B.  The is used both for generation and simulation so answer the result (for interpretation)"
	self instSize > 0 ifTrue: 
		[self error: 'cannot auto-coerce arrays with named instance variables'].
	^cg generateCoerceToObjectFromPtr: aNode on: aStream