*vmmakerjs
new
	JSCodeGenerator isActive ifTrue: [^JSCodeGenerator new].
	^super new