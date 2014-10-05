JS translation
generateAtPut: msgNode on: aStream indent: level
	"Generate the JS code for this message onto the given stream."
	| putExpr incExpr |
	self generateAt: msgNode on: aStream indent: level.

	(putExpr := msgNode args last) isPlusOne ifTrue: [
		((incExpr := putExpr receiver) isSend and: [incExpr selector = #at: and: [
			incExpr receiver asString = msgNode receiver asString and: [
			incExpr args first asString = msgNode args first asString]]])
				ifTrue: [^aStream nextPutAll: '++'.]].

	aStream nextPutAll: ' = '.
	self emitJSExpression: putExpr on: aStream