*vmmakerjs
emitJSCodeAsArgumentOn: aStream level: level generator: aCodeGen
	"Emit the receiver in a form that can be passed as an argument."

	"If the selector is a built-in construct, translate it and return"
	(aCodeGen emitBuiltinConstructAsArgumentFor: self asExpression on: aStream level: level) ifFalse:
		["If it is a pointer dereference generate it"
		(self emitJSCodeAsPointerDereferenceOn: aStream level: level generator: aCodeGen) ifFalse:
			["Otherwise generate the vanilla C function call."
			 self emitJSCodeAsFunctionCallOn: aStream level: level generator: aCodeGen]]