JS code generator
emitJSHeaderOn: aStream
	"Write a JS file header onto the given stream."

	aStream nextPutAll: '/* '.
	aStream nextPutAll: VMMaker headerNotice.
	aStream nextPutAll: ' */';cr.
	aStream nextPutAll: (self fileHeaderVersionStampForSourceClass: vmClass).
	aStream nextPutAll: '
module("users.bert.SqueakJS.plugins.', pluginName, '").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = ', InterpreterPrimitives vmProxyMajorVersion, ';
var VM_PROXY_MINOR = ', InterpreterPrimitives vmProxyMinorVersion, ';

'.