JS code generator
isPointerToStructVariableName: varName "<String>"
	^self isTypePointerToStruct: (self typeOfVariable: varName)