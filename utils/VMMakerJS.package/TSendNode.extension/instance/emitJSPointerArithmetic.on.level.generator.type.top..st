*vmmakerjs
emitJSPointerArithmetic: type on: aStream level: level generator: aGenerator type: cType top: top
	(selector = #+) ifFalse: [self halt].
	receiver isVariable
		ifTrue: [ | typeAndSize |
			typeAndSize := ({'int' -> #('Int32Array' 4). 'float' -> #('Float32Array' 4)} as: Dictionary)
				at: ((cType copyUpTo: $*) copyWithout: $ ).
			aStream nextPutAll: ('new {1}({2}.buffer, {2}.byteOffset + {3} * ('
					format: {typeAndSize first. receiver name. typeAndSize second})]
		ifFalse: [receiver emitJSPointerArithmetic: type on: aStream level: level generator: aGenerator type: cType top: false.
			aStream nextPutAll: ' + '].
	aGenerator emitJSExpression: arguments first on: aStream.
	top ifTrue: [aStream nextPutAll: '))'].