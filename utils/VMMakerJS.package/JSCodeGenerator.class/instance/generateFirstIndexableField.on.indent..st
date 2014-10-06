JS hacks
generateFirstIndexableField: msgNode on: aStream indent: level
	| parent cType accessor |
	self oneBasedArrays: false.
	"HACK: detect cType from parent node"
	parent := thisContext sender sender sender.
	cType := parent method == (TAssignmentNode>>#emitJSCodeOn:level:generator:) 
			ifTrue: [self typeOfVariable: parent receiver variable name] ifFalse: [
		parent method == (TSendNode>>#emitJSCodeAsFunctionCallOn:level:generator:)
			ifTrue: [self typeOfArgument: (parent receiver args indexOf: msgNode) in: parent receiver selector] ifFalse: [
		msgNode asString = 'interpreterProxy firstIndexableField: mapOop'
			ifTrue: ['unsigned int*'] ifFalse: [
		self halt]]].
	cType ifNotNil: [
		cType := cType copyReplaceAll: ' *' with: '* '.
		accessor := (cType beginsWith: 'unsigned char*') ifTrue: ['.bytes']
			ifFalse: [(cType beginsWith: 'unsigned int*') ifTrue: ['.words']
			ifFalse: [(cType beginsWith: 'int*') ifTrue: ['.wordsAsInt32Array()']
			ifFalse: [(cType beginsWith: 'char*') ifTrue: ['.bytes']
			ifFalse: [(cType beginsWith: 'float*') ifTrue: ['.wordsAsFloat32Array()']
			ifFalse: [self halt: 'need to handle ', cType]]]]].
		accessor ifNotNil: [msgNode args first emitJSCodeOn: aStream level: level generator: self.
			^aStream nextPutAll: accessor]].
	"generic code below, not needed ever hopefully"
	aStream nextPutAll: 'interpreterProxy.'.
	^ msgNode emitJSCodeAsFunctionCallOn: aStream level: level generator: self