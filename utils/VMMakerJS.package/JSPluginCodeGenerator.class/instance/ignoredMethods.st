public
ignoredMethods
	pluginName = 'BitBltPlugin' ifTrue: [
		^#(dstLongAt: dstLongAt:put: srcLongAt:)].
	pluginName = 'ScratchPlugin' ifTrue: [
			^(ScratchPlugin organization listAtCategoryNamed: 'serial port'), 
				(ScratchPlugin organization listAtCategoryNamed: 'os functions')].
	pluginName = 'B2DPlugin' ifTrue: [
		^self translatedMethodsB2DPlugin collect: [:ea | ea key]].
	^super ignoredMethods