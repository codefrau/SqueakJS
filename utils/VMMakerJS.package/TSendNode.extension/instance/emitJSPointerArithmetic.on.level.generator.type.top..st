*vmmakerjs
emitJSPointerArithmetic: type on: aStream level: level generator: aGenerator type: cType top: top
	(selector = #+) ifFalse: [self halt].
	receiver isVariable
		ifTrue: [ | func |
			func := ({'int' -> 'PTR_ADD'. 'float' -> 'FPTR_ADD'} as: Dictionary)
				at: ((cType copyUpTo: $*) copyWithout: $ ).
			aStream nextPutAll: func, '(',  receiver name, ', ']
		ifFalse: [receiver emitJSPointerArithmetic: type on: aStream level: level generator: aGenerator type: cType top: false.
			aStream nextPutAll: ' + '].
	aGenerator emitJSExpression: arguments first on: aStream.
	top ifTrue: [aStream nextPutAll: ')'].