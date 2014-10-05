JS hacks
generateIntAtPointer: msgNode on: aStream indent: level
	msgNode args first asString = 'self cCoerce: argPtr + i to: ''char*'''
		ifTrue: [^aStream nextPutAll: 'argPtr[i]'].
	self halt
	

	