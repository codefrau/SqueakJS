specifying primitives
isPrimitiveDirectiveSend: stmt
	
	stmt isSend ifTrue:
		[stmt selector = #primitive: ifTrue:
			[^self primitive: 	stmt args first value
				   parameters:	(Array new: args size withAll: #Oop)
				   receiver:		#Oop].
		 stmt selector = #primitive:parameters: ifTrue:
			[^self primitive: 	stmt args first value
				   parameters: 	stmt args second value
				   receiver:		#Oop].
		 stmt selector = #primitive:parameters:receiver: ifTrue:
			[^self primitive:		stmt args first value
				   parameters:	stmt args second value
				   receiver:		stmt args third value].
		^false].
	^false.
