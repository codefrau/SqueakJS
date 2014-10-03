*vmmakerjs
emitJSCodeOn: aStream level: level generator: aCodeGen
	"Emit a comment only"

	aStream cr; nextPutAll: '/*** ';
		nextPutAll: self printString;
		nextPutAll: ' cannot translate: '; cr;
		nextPutAll: parseNode printString;
		cr; nextPutAll: ' ***/'; cr
