JS hacks
generateOopForPointer: msgNode on: aStream indent: level
	| arg |
	arg := msgNode args first asString.
	arg = 'interpreterProxy firstIndexableField: destBits'
		ifTrue: [^aStream nextPutAll: 'destBits.wordsOrBytes()'].
	arg = 'interpreterProxy firstIndexableField: sourceBits'
		ifTrue: [^aStream nextPutAll: 'sourceBits.wordsOrBytes()'].
	arg =  'interpreterProxy firstIndexableField: halftoneBits'
		ifTrue: [^aStream nextPutAll: 'halftoneBits.wordsOrBytes()'].
	arg =  'interpreterProxy firstIndexableField: sourceMapOop'
		ifTrue: [^aStream nextPutAll: 'sourceMapOop.wordsOrBytes()'].
	self halt
