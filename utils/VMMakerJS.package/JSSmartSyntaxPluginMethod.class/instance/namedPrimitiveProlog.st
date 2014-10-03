specifying primitives
namedPrimitiveProlog

	| cg |
	cg := SmartSyntaxPluginCodeGenerator new.
	^Array streamContents: [:sStream |
		1 to: fullArgs size do:
			[:i |
			 sStream nextPutAll: 
				(self 
					statementsFor: 
						((parmSpecs at: i) 
							jscg: 	cg
							prolog:  [:expr | (fullArgs at: i), ' := ', expr]
							expr: (fullArgs at: i)
							index: (fullArgs size - i))
					varName: '')]]