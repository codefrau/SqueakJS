*vmmakerjs
jscg: cg generateCoerceToOopFrom: aNode on: aStream
	"N.B.  The is used both for generation and simulation so answer the result (for interpretation)"
	^cg generateCoerceToFloatObjectFrom: aNode on: aStream