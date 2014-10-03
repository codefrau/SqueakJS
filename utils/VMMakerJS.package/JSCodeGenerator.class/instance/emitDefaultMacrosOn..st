JS code generator
emitDefaultMacrosOn: aStream
	"Emit macros to provide default implementations of certain functions used by
	the interpreter. If not previously defined in config.h they will be defined here.
	The definitions will be available to any module that includes sqMemoryAccess.h.
	The default macros are chosen for backward compatibility with existing platform
	support code."

	"Reduce the obscurity of these macros by flagging some selectors to
	make this method show up as a sender."

	self flag: #assert:.
	"If assert() has not been defined e.g. by sqAssert.h, then use the standard clib version"
	aStream cr;
		nextPutAll: '#ifndef assert'; cr;
		nextPutAll: ' #include <assert.h>'; cr;
		nextPutAll: '#endif'; cr.

	self flag: #allocateMemory:minimum:imageFile:headerSize:.
	aStream cr;
		nextPutAll: '#ifndef allocateMemoryMinimumImageFileHeaderSize'; cr;
		nextPutAll: ' /* Called by Interpreter>>allocateMemory:minimum:imageFile:headerSize: */'; cr;
		nextPutAll: ' /* Default definition if not previously defined in config.h */'; cr;
		nextPutAll: ' #define allocateMemoryMinimumImageFileHeaderSize(',
						'heapSize, minimumMemory, fileStream, headerSize) \'; cr;
		nextPutAll: '    sqAllocateMemory(minimumMemory, heapSize)'; cr;
		nextPutAll: '#endif'; cr.

	self flag: #sqImage:read:size:length:.
	aStream cr;
		nextPutAll: '#ifndef sqImageFileReadEntireImage'; cr;
		nextPutAll: ' /* Called by Interpreter>>sqImage:read:size:length: */'; cr;
		nextPutAll: ' /* Default definition if not previously defined in config.h */'; cr;
		nextPutAll: ' #define sqImageFileReadEntireImage(memoryAddress, ',
						'elementSize,  length, fileStream) \'; cr;
		nextPutAll: '    sqImageFileRead(memoryAddress, elementSize,  length, fileStream)'; cr;
		nextPutAll: '#endif'; cr.

	self flag: #error:.
	aStream cr;
		nextPutAll: '#ifndef error'; cr;
		nextPutAll: ' /* error() function called from Interpreter */'; cr;
		nextPutAll: ' /* Default definition if not previously defined in config.h */'; cr;
		nextPutAll: ' #define error(str) defaultErrorProc(str)'; cr;
		nextPutAll: '#endif'; cr.

	self flag: #primitiveMicrosecondClock; flag: #ioMicroSecondClock.
	aStream cr;
		nextPutAll: '#ifndef ioMicroSecondClock'; cr;
		nextPutAll: ' /* Called by Interpreter>>primitiveMicrosecondClock and GC methods */'; cr;
		nextPutAll: ' /* Default definition if not previously defined in config.h */'; cr;
		nextPutAll: ' #define ioMicroSecondClock ioMSecs'; cr;
		nextPutAll: '#endif'; cr.

	self flag: #primitiveUtcWithOffset; flag: #setMicroSeconds:andOffset:.
	aStream cr;
		nextPutAll: '#ifndef ioUtcWithOffset'; cr;
		nextPutAll: ' /* Called by Interpreter>>primitiveUtcWithOffset */'; cr;
		nextPutAll: ' /* Default definition if not previously defined in config.h */'; cr;
		nextPutAll: ' #define ioUtcWithOffset(clock, offset) setMicroSecondsandOffset(clock, offset)'; cr;
		nextPutAll: '#endif'; cr.
