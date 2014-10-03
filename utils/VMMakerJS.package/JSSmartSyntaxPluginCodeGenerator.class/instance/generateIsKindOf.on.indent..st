translating builtins
generateIsKindOf: aNode on: aStream indent: anInteger
	| className |
	className := aNode args second value.
	(#('LargePositiveInteger', 'LargeNegativeInteger') includes: className) ifTrue: [
		self emitJSExpression: aNode args first on: aStream.
		^aStream nextPutAll: '.sqClass === interpreterProxy.class', className, '()'].
	(#('Integer') includes: className) ifFalse: [self halt: 'isKindOf: ', className].
	aStream nextPutAll: 'interpreterProxy.isKindOf', className, '('.
	self emitJSExpression: aNode args first on: aStream.
	aStream nextPutAll: ')'.