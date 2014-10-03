inlining
isFunctional
	"Answer true if the receiver is a functional method. That is, if it consists of a single return statement of an expression that contains no other returns."

	(parseTree statements size = 1 and:
	 [parseTree statements last isReturn]) ifFalse: [ ^false ].
	parseTree statements last expression nodesDo: [ :n | n isReturn ifTrue: [ ^false ]].
	^true