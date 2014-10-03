JS translation
generateInlineCPreprocessorDirective: msgNode on: aStream indent: level
	"Generate the C preprocessor directive for this message onto the given stream."
self halt.
	aStream cr; nextPutAll: msgNode args first value