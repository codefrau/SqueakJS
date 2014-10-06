JS hacks
generateByteAtPointer: msgNode on: aStream indent: level
	msgNode args first asString = 'sourcePtr + charIndex - 1'
		ifTrue: [^aStream nextPutAll: 'sourcePtr[charIndex - 1]'].
	self halt
	