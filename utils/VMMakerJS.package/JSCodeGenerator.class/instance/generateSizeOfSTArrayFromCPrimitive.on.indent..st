JS hacks
generateSizeOfSTArrayFromCPrimitive: msgNode on: aStream indent: level
	| cType sizer |
	cType := self typeOfVariable: msgNode args first name.
	cType ifNotNil: [
		sizer := (cType includesSubString: 'char *') ifTrue: ['.length'] ifFalse: [
			(cType beginsWith: 'int *') ifTrue: ['.length'] 
			ifFalse: [self halt: 'need to handle ', cType]]].
		sizer ifNotNil: [msgNode args first emitJSCodeOn: aStream level: level generator: self.
			^aStream nextPutAll: sizer].
	self halt.
	"generic code below, not needed ever hopefully"
	aStream nextPutAll: 'interpreterProxy.'.
	^ msgNode emitJSCodeAsFunctionCallOn: aStream level: level generator: self