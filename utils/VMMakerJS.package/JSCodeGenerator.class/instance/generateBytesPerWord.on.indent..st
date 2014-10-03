JS translation
generateBytesPerWord: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
self halt.
	aStream nextPutAll: 'BYTES_PER_WORD'
