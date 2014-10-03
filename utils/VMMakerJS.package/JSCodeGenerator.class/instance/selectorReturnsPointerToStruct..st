JS code generator
selectorReturnsPointerToStruct: selector "<Symbol>"
	| tMethod |
	^vmClass notNil
	  and: [(tMethod := methods at: selector ifAbsent: []) notNil
	  and: [vmClass isTypePointerToStruct: tMethod returnType]]