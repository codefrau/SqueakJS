*vmmakerjs
emitJSCodeOn: aStream level: level generator: aCodeGen
	"Emit the receiver as a statement."

	"If the selector is a built-in construct, translate it and return"
	(aCodeGen emitBuiltinConstructFor: self on: aStream level: level) ifFalse:
		["If it is a pointer dereference generate it"
		(self emitJSCodeAsPointerDereferenceOn: aStream level: level generator: aCodeGen) ifFalse:
			["Otherwise generate the vanilla C function call."
			 self emitJSCodeAsFunctionCallOn: aStream level: level generator: aCodeGen]]