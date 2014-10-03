JS code generator
emitDefineBytesPerWordOn: aStream
	"Define word size dependent constants. These are mirrored by class
	variables in ObjectMemory. The macro definitions here are used at compile
	time to permit building a VM for either 32-bit or 64-bit object memory from
	a single generated code base.
	
	If SQ_VI_BYTES_PER_WORD is defined as 8 (e.g. in config.h), then a VM for
	64-bit image will be built. Otherwise, a VM for 32-bit image is built."

	aStream cr;
		nextPutAll: '/*'; cr;
		nextPutAll: ' * define SQ_VI_BYTES_PER_WORD 8 for a 64-bit word size VM'; cr;
		nextPutAll: ' * and default to SQ_VI_BYTES_PER_WORD 4 for a 32-bit word size VM'; cr;
		nextPutAll: ' */'; cr;
		nextPutAll: '#ifndef SQ_VI_BYTES_PER_WORD'; cr;
		nextPutAll: '# define SQ_VI_BYTES_PER_WORD ';
		print: 4; cr; "default to word size 4"
		nextPutAll: '#endif'; cr; cr;
		nextPutAll: '#define BYTES_PER_WORD SQ_VI_BYTES_PER_WORD'; cr;
		nextPutAll: '#define BASE_HEADER_SIZE SQ_VI_BYTES_PER_WORD'; cr;

		"Define various constants that depend on BytesPerWord"
		nextPutAll: '#if (BYTES_PER_WORD == 4) // 32-bit object memory'; cr;
		nextPutAll: '# define WORD_MASK 0xffffffff'; cr; "(1 bitShift: BytesPerWord*8) - 1"
		nextPutAll: '# define SHIFT_FOR_WORD 2'; cr; "(BytesPerWord log: 2) rounded"
		nextPutAll: '# define SMALL_CONTEXT_SIZE 92'; cr; "ContextFixedSizePlusHeader + 16 * BytesPerWord"
		"Large contexts have 56 indexable fileds.  Max with single header word."
		"However note that in 64 bits, for now, large contexts have 3-word headers"
		nextPutAll: '# define LARGE_CONTEXT_SIZE 252'; cr; "ContextFixedSizePlusHeader + 56 * BytesPerWord."
		nextPutAll: '# define SIZE_MASK 0xfc'; cr; "Base header word bit field"
		nextPutAll: '# define LONG_SIZE_MASK 0xfffffffc'; cr; "Base header word bit field"
		nextPutAll: '# define SIZE_4_BIT 0'; cr;
		nextPutAll: '# define MARK_BIT 0x80000000'; cr; "Top bit, 1 bitShift: BytesPerWord*8 - 1"
		nextPutAll: '# define ROOT_BIT 0x40000000'; cr; "Next-to-top bit, 1 bitShift: BytesPerWord*8 - 2"
		nextPutAll: '# define ALL_BUT_MARK_BIT 0x7fffffff'; cr; "WordMask - MarkBit."
		nextPutAll: '# define ALL_BUT_ROOT_BIT 0xbfffffff'; cr; "WordMask - RootBit"
		nextPutAll: '# define ALL_BUT_TYPE_MASK 0xfffffffc'; cr; "WordMask - TypeMask"
		nextPutAll: '# define ALL_BUT_MARK_BIT_AND_TYPE_MASK 0x7ffffffc'; cr; "AllButTypeMask - MarkBit"
		nextPutAll: '# define ALL_BUT_HASH_BITS 0xe001ffff'; cr;
		nextPutAll: '# define SMALL_CONTEXT_SIZE 92'; cr; "16 indexable fields"
		nextPutAll: '# define LARGE_CONTEXT_SIZE 252'; cr; "56 indexable fields"

		nextPutAll: '#else // 64-bit object memory'; cr;
		nextPutAll: '# define WORD_MASK 0xffffffffffffffff'; cr;
		nextPutAll: '# define SHIFT_FOR_WORD 3'; cr;
		nextPutAll: '# define SMALL_CONTEXT_SIZE 184'; cr;
		nextPutAll: '# define LARGE_CONTEXT_SIZE 504'; cr;
		nextPutAll: '# define SIZE_MASK 0xf8'; cr; "Lose the 4 bit in temp 64-bit chunk format"
		nextPutAll: '# define LONG_SIZE_MASK 0xfffffffffffffff8'; cr;
		"The 4 bit is excluded from SIZE_MASK for 64-bit object memory, but need it"
		"for ST size, so define SIZE_4_BIT."
		nextPutAll: '# define SIZE_4_BIT 4'; cr;
		nextPutAll: '# define MARK_BIT 0x8000000000000000'; cr;
		nextPutAll: '# define ROOT_BIT 0x4000000000000000'; cr;
		nextPutAll: '# define ALL_BUT_MARK_BIT 0x7fffffffffffffff'; cr;
		nextPutAll: '# define ALL_BUT_ROOT_BIT 0xbfffffffffffffff'; cr;
		nextPutAll: '# define ALL_BUT_TYPE_MASK 0xfffffffffffffffc'; cr;
		nextPutAll: '# define ALL_BUT_MARK_BIT_AND_TYPE_MASK 0x7ffffffffffffffc'; cr;
		nextPutAll: '# define ALL_BUT_HASH_BITS 0xffffffffe001ffff'; cr;
		nextPutAll: '# define SMALL_CONTEXT_SIZE 184'; cr;
		nextPutAll: '# define LARGE_CONTEXT_SIZE 504'; cr;
		nextPutAll: '#endif //  (BYTES_PER_WORD == 4)'; cr
	
