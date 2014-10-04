*vmmakerjs
new
	JSCodeGenerator isActive ifTrue: [^JSPluginCodeGenerator new].
	^super new