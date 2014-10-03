generating JS code
emitJSHeaderOn: aStream generator: aCodeGen
	"Emit a C function header for this method onto the given stream."

	aStream cr. 
	self emitJSFunctionHeader: aStream generator: aCodeGen.
	aStream nextPutAll: ' {'; cr.
	locals do: [ :var |
		aStream nextPutAll: '	var ', (aCodeGen returnPrefixFromVariable: var), ';'; cr.
	].
	locals isEmpty ifFalse: [ aStream cr ].