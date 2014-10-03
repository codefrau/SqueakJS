JS code generator
isTypePointerToStruct: type "<String>"
	^vmClass notNil
	  and: [vmClass isTypePointerToStruct: type]