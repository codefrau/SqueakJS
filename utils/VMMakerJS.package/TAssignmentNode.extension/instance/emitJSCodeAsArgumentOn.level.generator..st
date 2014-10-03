*vmmakerjs
emitJSCodeAsArgumentOn: aStream level: level generator: aCodeGen
	aStream nextPut: $(.
	self emitJSCodeOn: aStream level: level generator: aCodeGen.
	aStream nextPut: $)