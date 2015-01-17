accessing
printOn: aStream
	[aStream nextPutAll: self asString]
		ifError: [:err :rcvr | ^ super printOn: aStream].
