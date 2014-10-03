JS translation
generateBaseHeaderSize: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
self halt.
	aStream nextPutAll: 'BASE_HEADER_SIZE'

