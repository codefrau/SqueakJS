JS translation
generatePerform: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
self halt.
	self emitJSExpression: msgNode args first on: aStream.
	aStream nextPut: $(.
	(msgNode args copyFrom: 2 to: msgNode args size) do:[:arg|
		self emitJSExpression: arg on: aStream.
	] separatedBy:[aStream nextPutAll:', '].
	aStream nextPut: $)