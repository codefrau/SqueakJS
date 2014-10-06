JS translation
generateCCoercion: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| expr cType |.
	expr := msgNode args first.
	cType := msgNode args second value.
	(expr isSend and: [expr receiver name = 'interpreterProxy' and: [expr selector = #firstIndexableField:]]) ifTrue: [
		cType := msgNode args second value.
		self emitJSExpression: expr args first on: aStream.
		cType = 'unsigned char *' ifTrue: [^aStream nextPutAll: '.bytes'].
		cType = 'int *' ifTrue: [^aStream nextPutAll: '.wordsAsInt32Array()'].
		cType = 'float *' ifTrue: [^aStream nextPutAll: '.wordsAsFloat32Array()'].
		self halt.
	] ifFalse: [
		((#('double' 'float') includes: cType) or: ['sqInt (*)(*)'match: cType])
			ifFalse: [self halt].
		self emitJSExpression: expr on: aStream.
	]
