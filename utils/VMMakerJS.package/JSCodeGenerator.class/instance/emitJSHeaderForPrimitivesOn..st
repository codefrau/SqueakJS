JS code generator
emitJSHeaderForPrimitivesOn: aStream
	"Write a C file header for compiled primitives onto the given stream."

	aStream
		nextPutAll: '/* Automatically generated from Squeak (';
		nextPutAll: VMMaker versionString;
		nextPutAll: ') on '.
	Time dateAndTimeNow do: [:e | aStream nextPutAll: e asString; nextPut: Character space].
	aStream
		nextPutAll: '*/';
		cr; cr;
		nextPutAll: '#include "sq.h"'; cr; cr.

	"Additional header files"
	headerFiles do:[:hdr|
		aStream nextPutAll:'#include '; nextPutAll: hdr; cr].

	aStream nextPutAll: '
#include "sqMemoryAccess.h"

/*** Imported Functions/Variables ***/
extern sqInt stackValue(sqInt);
extern sqInt stackIntegerValue(sqInt);
extern sqInt successFlag;

/* allows accessing Strings in both C and Smalltalk */
#define asciiValue(c) c
'.
	aStream cr.