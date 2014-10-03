*vmmakerjs
new
	JSCodeGenerator isActive ifTrue: [^JSSmartSyntaxPluginCodeGenerator new].
	^super new