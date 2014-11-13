JS code generator
emitJSHeaderOn: aStream
	"Write a JS file header onto the given stream."

	aStream nextPutAll: '/* '.
	aStream nextPutAll: (VMMaker headerNotice copyReplaceAll: ' C ' with: ' JS ').
	aStream nextPutAll: ' */';cr.
	aStream nextPutAll: (self fileHeaderVersionStampForSourceClass: vmClass).
	aStream nextPutAll: '
module("users.bert.SqueakJS.plugins.', pluginName, '").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = ', InterpreterPrimitives vmProxyMajorVersion, ';
var VM_PROXY_MINOR = ', InterpreterPrimitives vmProxyMinorVersion, ';

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }
function PTR_ADD(p, n) { return new Int32Array(p.buffer, p.byteOffset + n * 4); }
function FPTR_ADD(p, n) { return new Float32Array(p.buffer, p.byteOffset + n * 4); }

'.