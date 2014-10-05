JS translation
initializeCTranslationDictionary 
	"Initialize the dictionary mapping message names to actions for C code generation."

	| pairs |
	translationDict := Dictionary new: 200.
	pairs := #(
	#&				#generateAnd:on:indent:
	#|				#generateOr:on:indent:
	#and:			#generateSequentialAnd:on:indent:
	#or:			#generateSequentialOr:on:indent:
	#not			#generateNot:on:indent:

	#+				#generatePlus:on:indent:
	#-				#generateMinus:on:indent:
	#negated		#generateNegated:on:indent:
	#*				#generateTimes:on:indent:
	#/				#generateDivide:on:indent:
	#//				#generateDivide:on:indent:
	#\\				#generateModulo:on:indent:
	#<<			#generateShiftLeft:on:indent:
	#>>			#generateShiftRight:on:indent:
	#min:			#generateMin:on:indent:
	#max:			#generateMax:on:indent:
	#between:and:	#generateBetweenAnd:on:indent:

	#bitAnd:		#generateBitAnd:on:indent:
	#bitOr:			#generateBitOr:on:indent:
	#bitXor:		#generateBitXor:on:indent:
	#bitShift:		#generateBitShift:on:indent:
	#signedBitShift:	#generateSignedBitShift:on:indent:
	#bitInvert32		#generateBitInvert32:on:indent:
	#bitClear:			#generateBitClear:on:indent:

	#<				#generateLessThan:on:indent:
	#<=			#generateLessThanOrEqual:on:indent:
	#=				#generateEqual:on:indent:
	#>				#generateGreaterThan:on:indent:
	#>=			#generateGreaterThanOrEqual:on:indent:
	#~=			#generateNotEqual:on:indent:
	#==			#generateEqual:on:indent:
	#~~			#generateNotEqual:on:indent:
	#isNil			#generateIsNil:on:indent:
	#notNil			#generateNotNil:on:indent:

	#whileTrue: 	#generateWhileTrue:on:indent:
	#whileFalse:	#generateWhileFalse:on:indent:
	#whileTrue 		#generateDoWhileTrue:on:indent:
	#whileFalse		#generateDoWhileFalse:on:indent:
	#to:do:			#generateToDo:on:indent:
	#to:by:do:		#generateToByDo:on:indent:
	#repeat 		#generateRepeat:on:indent:

	#ifTrue:			#generateIfTrue:on:indent:
	#ifFalse:		#generateIfFalse:on:indent:
	#ifTrue:ifFalse:	#generateIfTrueIfFalse:on:indent:
	#ifFalse:ifTrue:	#generateIfFalseIfTrue:on:indent:

	#at:			#generateAt:on:indent:
	#at:put:			#generateAtPut:on:indent:
	#basicAt:		#generateAt:on:indent:
	#basicAt:put:	#generateAtPut:on:indent:

	#integerValueOf:			#generateIntegerValueOf:on:indent:
	#integerObjectOf:			#generateIntegerObjectOf:on:indent:
	#isIntegerObject: 			#generateIsIntegerObject:on:indent:
	#cCode:					#generateInlineCCode:on:indent:
	#cCode:inSmalltalk:			#generateInlineCCode:on:indent:
	#cPreprocessorDirective:	#generateInlineCPreprocessorDirective:on:indent:
	#preprocessorExpression:	#generateInlineCppDirective:on:indent:
	#isDefined:inSmalltalk:comment:ifTrue:	#generateInlineCppIfDef:on:indent:
	#isDefined:inSmalltalk:comment:ifTrue:ifFalse:	#generateInlineCppIfDefElse:on:indent:
	#isDefinedTrueExpression:inSmalltalk:comment:ifTrue:ifFalse:	#generateInlineCppIfElse:on:indent:
	#cCoerce:to:				#generateCCoercion:on:indent:
	#cCoerceSimple:to:			#generateCCoercion:on:indent:
	#addressOf:				#generateAddressOf:on:indent:
	#signedIntFromLong			#generateSignedIntFromLong:on:indent:
	#signedIntToLong			#generateSignedIntToLong:on:indent:
	#signedIntFromShort		#generateSignedIntFromShort:on:indent:
	#signedIntToShort			#generateSignedIntToShort:on:indent:
	#preIncrement				#generatePreIncrement:on:indent:
	#preDecrement				#generatePreDecrement:on:indent:
	#inline:						#generateInlineDirective:on:indent:
	#asFloat					#generateAsFloat:on:indent:
	#asInteger					#generateAsInteger:on:indent:
	#asUnsignedInteger			#generateAsUnsignedInteger:on:indent:
	#asSymbol					#generateAsSymbol:on:indent:
	#anyMask:					#generateBitAnd:on:indent:
	#raisedTo:					#generateRaisedTo:on:indent:
	#touch:						#generateTouch:on:indent:
	#bytesPerWord		#generateBytesPerWord:on:indent:
	#baseHeaderSize		#generateBaseHeaderSize:on:indent:

	#sharedCodeNamed:inCase:		#generateSharedCodeDirective:on:indent:

	#perform:							#generatePerform:on:indent:
	#perform:with:						#generatePerform:on:indent:
	#perform:with:with:					#generatePerform:on:indent:
	#perform:with:with:with:				#generatePerform:on:indent:
	#perform:with:with:with:with:		#generatePerform:on:indent:
	#perform:with:with:with:with:with:	#generatePerform:on:indent:

	#shouldNotImplement				#generateSmalltalkMetaError:on:indent:
	#shouldBeImplemented				#generateSmalltalkMetaError:on:indent:

	"optimized interpreterProxy calls"
	#firstIndexableField:				#generateFirstIndexableField:on:indent:
	#slotSizeOf:						#generateSlotSizeOf:on:indent:
	#stSizeOf:							#generateSlotSizeOf:on:indent:
	#byteSizeOfBytes:					#generateByteSizeOf:on:indent:
	#byteSizeOf:						#generateByteSizeOf:on:indent:
	#fetchClassOf:						#generateFetchClassOf:on:indent:
	#superclassOf:						#generateSuperclassOf:on:indent:
	#instanceSizeOf:					#generateInstanceSizeOf:on:indent:
	#is:KindOf: 							#generateIsKindOf:on:indent:
	#isFloatObject:						#generateIsFloatObject:on:indent:
	#cDigitCopyFrom:to:len:				#generateCDigitCopy:on:indent:
	#sizeOfSTArrayFromCPrimitive:		#generateSizeOfSTArrayFromCPrimitive:on:indent:
	#asciiValue							#generateIdentityUnary:on:indent:
	#primitiveFail						#generateInterpreterProxyCall:on:indent:
	#intAtPointer:						#generateIntAtPointer:on:indent:
	).

	1 to: pairs size by: 2 do: [:i |
		translationDict at: (pairs at: i) put: (pairs at: i + 1)].

	pairs := #(
	#ifTrue:				#generateIfTrueAsArgument:on:indent:	
	#ifFalse:			#generateIfFalseAsArgument:on:indent:
	#ifTrue:ifFalse:		#generateIfTrueIfFalseAsArgument:on:indent:
	#ifFalse:ifTrue:		#generateIfFalseIfTrueAsArgument:on:indent:
	#cCode:			#generateInlineCCodeAsArgument:on:indent:
	#cCode:inSmalltalk:	#generateInlineCCodeAsArgument:on:indent:
	).

	asArgumentTranslationDict := Dictionary new: 8.
	1 to: pairs size by: 2 do: [:i |
		asArgumentTranslationDict at: (pairs at: i) put: (pairs at: i + 1)].

	cCodeTranslationDict := Dictionary new: 8.
	pairs := #(
		'fprintf(stderr, "\n%s: %s", moduleName, s)'					'console.log(moduleName + ": " + s)'
		'interpreterProxy->majorVersion() == VM_PROXY_MAJOR'	'interpreterProxy.majorVersion() == VM_PROXY_MAJOR'
		'interpreterProxy->minorVersion() >= VM_PROXY_MINOR'	'interpreterProxy.minorVersion() >= VM_PROXY_MINOR'
		'sqrt(result)'												'Math.sqrt(result)'
		'sqrt(len)'													'Math.sqrt(len)'
	).
	1 to: pairs size by: 2 do: [:i |
		cCodeTranslationDict at: (pairs at: i) put: (pairs at: i + 1)].
