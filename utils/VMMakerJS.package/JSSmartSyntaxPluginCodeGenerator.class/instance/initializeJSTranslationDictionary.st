translating builtins
initializeJSTranslationDictionary 
	"Initialize the dictionary mapping message names to actions for C code generation."

	| pairs |
	super initializeJSTranslationDictionary.
	pairs := #(
		#asCInt						#generateAsCInt:on:indent:
		#asCUnsigned				#generateAsCUnsigned:on:indent:
		#asCBoolean					#generateAsCBoolean:on:indent:
		#asCDouble					#generateAsCDouble:on:indent:

		#asSmallIntegerObj			#generateAsSmallIntegerObj:on:indent:
		#asPositiveIntegerObj		#generateAsPositiveIntegerObj:on:indent:
		#asBooleanObj				#generateAsBooleanObj:on:indent:
		#asFloatObj					#generateAsFloatObj:on:indent:

		#asIf:var:					#generateAsIfVar:on:indent:
		#asIf:var:asValue:			#generateAsIfVarAsValue:on:indent:
		#asIf:var:put:				#generateAsIfVarPut:on:indent:
		#field:						#generateField:on:indent:
		#field:put:					#generateFieldPut:on:indent:
		
		#class						#generateClass:on:indent:

		#stSize						#generateStSize:on:indent:
		#stAt:						#generateStAt:on:indent:
		#stAt:put:					#generateStAtPut:on:indent:

		#asCharPtr					#generateAsCharPtr:on:indent:
		#asIntPtr					#generateAsIntPtr:on:indent:
		#cPtrAsOop					#generateCPtrAsOop:on:indent:
		#next						#generateNext:on:indent:

		#asOop:						#generateAsOop:on:indent:
		#asValue:					#generateAsValue:on:indent:

		#isFloat						#generateIsFloat:on:indent:
		#isIndexable					#generateIsIndexable:on:indent:
		#isIntegerOop				#generateIsIntegerOop:on:indent:
		#isIntegerValue				#generateIsIntegerValue:on:indent:
		#FloatOop					#generateIsFloatValue:on:indent:
		#isWords					#generateIsWords:on:indent:
		#isWordsOrBytes				#generateIsWordsOrBytes:on:indent:
		#isPointers					#generateIsPointers:on:indent:
		#isNil						#generateIsNil:on:indent:
		#isMemberOf:				#generateIsMemberOf:on:indent:
		#isKindOf:					#generateIsKindOf:on:indent:

		#fromStack:					#generateFromStack:on:indent:
		#clone						#generateClone:on:indent
		#new						#generateNew:on:indent
		#new:						#generateNewSize:on:indent
		#superclass					#generateSuperclass:on:indent:
		#remapOop:in:				#generateRemapOopIn:on:indent:
		#debugCode:					#generateDebugCode:on:indent:
	).

	1 to: pairs size by: 2 do: [:i |
		translationDict at: (pairs at: i) put: (pairs at: i + 1)].
