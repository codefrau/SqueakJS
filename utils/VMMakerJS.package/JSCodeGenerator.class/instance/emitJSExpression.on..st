JS code generator
emitJSExpression: aParseNode on: aStream 
	"Emit C code for the expression described by the given parse node."

	aParseNode isLeafOrFunc 
		ifTrue: 
			["omit parens"
			 aParseNode emitJSCodeAsExpressionOn: aStream level: 0 generator: self]
		ifFalse: 
			[aStream nextPut: $(.
			 aParseNode emitJSCodeAsExpressionOn: aStream level: 0 generator: self.
			 aStream nextPut: $)]