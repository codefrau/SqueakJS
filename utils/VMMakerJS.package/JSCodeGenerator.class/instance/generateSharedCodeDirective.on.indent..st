JS translation
generateSharedCodeDirective: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	aStream nextPutAll: '/* common code: '.
	aStream nextPutAll: msgNode args first value.
	aStream nextPutAll: ' */'.
