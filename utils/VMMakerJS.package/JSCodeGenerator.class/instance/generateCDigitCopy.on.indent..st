JS hacks
generateCDigitCopy: msgNode on: aStream indent: level
	"LargeIntegerPlugin>>cDigitReplace:from:to:with:startingAt: uses pointer arithmetic. Replace it here"
	msgNode args first selector = #+ ifFalse: [
		^msgNode emitJSCodeAsFunctionCallOn: aStream level: level generator: self].
	msgNode asString = 'self cDigitCopyFrom: pFrom + repStart to: pTo + start len: stop - start + 1'
		ifFalse: [self halt: 'not handled: ', msgNode asString].
	aStream nextPutAll: 'function() {
		// inlining ', msgNode asString, '
		var len = stop - start + 1;
		for (var i = 0; i < len; i++) {
			pTo[i + start] = pFrom[i + repStart];
		}
		return 0;
	}();
'