JS code generator
isTypePointerToStruct: type "<String>"
	^pluginClass notNil
	  and: [[pluginClass isTypePointerToStruct: type]
			on: MessageNotUnderstood
			do: [:ex| ex message selector == #isTypePointerToStruct: ifTrue: [^false].
					ex pass]]