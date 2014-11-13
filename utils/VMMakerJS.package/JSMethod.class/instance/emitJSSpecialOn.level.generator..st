JS hacks
emitJSSpecialOn: aStream level: level generator: aCodeGen
	| expr type |
	aCodeGen pluginName = 'B2DPlugin' ifFalse: [^false].
	(returnType includes: $*) ifFalse: [^false].
	parseTree statements first isReturn ifFalse: [^false].
	expr := parseTree statements first expression.
	expr isSend ifFalse: [^false].
	type := returnType.
	expr selector = #cCoerce:to: ifTrue: [
		type = expr args second value ifFalse: [self halt].
		expr := expr args first.
	].
	expr selector = #+ ifFalse: [^false].
	aStream tab: level; nextPutAll: 'return '.
	expr emitJSPointerArithmetic: type on: aStream level: level generator: aCodeGen type: type top: true.
	aStream nextPutAll: ';'; cr. 
	^true
