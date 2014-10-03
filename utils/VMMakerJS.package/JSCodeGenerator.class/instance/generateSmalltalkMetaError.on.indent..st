JS translation
generateSmalltalkMetaError: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."

	aStream nextPutAll: 'throw Error("'; nextPutAll: msgNode selector; nextPutAll: '")'