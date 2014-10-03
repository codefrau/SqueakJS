JS code generator
emitJSConstantsOn: aStream
	"Store the global variable declarations on the given stream."
	| unused constList node |
	unused := constants keys asSet.
	methods do: [ :meth |
		meth parseTree nodesDo: [ :n |
			n isConstant ifTrue: [ unused remove: n name ifAbsent: []]]].
	constList := constants keys reject: [ :any | unused includes: any].
	constList isEmpty ifTrue: [^self].
	aStream nextPutAll: '/*** Constants ***/';
		 cr.
	constList asSortedCollection do: [ :varName |
		node := constants at: varName.
		node name isEmpty ifFalse: [
			aStream nextPutAll: '#define '.
			aStream nextPutAll: node name.
			aStream space.
			aStream nextPutAll: (self cLiteralFor: node value).
			aStream cr
		].
	].
	aStream cr.