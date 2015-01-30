*jsbridge-core
asJSObject
	"Only for debugging! Allows to pass a Squeak object to JavaScript without converting"
	^JSObjectProxy basicNew primSqueakAsJSObject: self
