*vmmakerjs
emitJSCodeOn: aStream level: level generator: aCodeGen

	name = 'nil'
		ifTrue: [ aStream nextPutAll: (aCodeGen jsLiteralFor: nil) ]
		ifFalse: [ aStream nextPutAll: (aCodeGen returnPrefixFromVariable: name) ].