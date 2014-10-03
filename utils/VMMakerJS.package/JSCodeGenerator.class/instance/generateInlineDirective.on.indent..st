JS translation
generateInlineDirective: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	aStream nextPutAll: '/* inline: '.
	aStream nextPutAll: msgNode args first value asString.
	aStream nextPutAll: ' */'.
