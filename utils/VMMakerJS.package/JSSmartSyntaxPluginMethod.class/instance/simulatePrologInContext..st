specifying primitives
simulatePrologInContext: aContext

	|cg instructions |
	cg := SmartSyntaxPluginCodeGenerator new.
	parmSpecs keysAndValuesDo: 
		[:index :each |
		 instructions := ((parmSpecs at: index)
			jscg: cg 
			prolog: (cg jscgTVarBlock: index) 
			expr: '<foo>' 
			index: args size - index).
		 Compiler new 
			evaluate: instructions
			in: aContext 
			to: aContext receiver
			notifying: nil
			ifFail: nil].
	instructions := (rcvrSpec
		jscg: cg 
		prolog: [:expr | '^', expr]
		expr: '<foo>' 
		index: args size).
	 ^Compiler new 
		evaluate: instructions
		in: aContext 
		to: aContext receiver
		notifying: nil
		ifFail: nil