private
oopVariable: aString

	(locals includes: aString) ifFalse:
		[locals add: aString.
		 declarations
			at: aString 
			put: 'sqInt ', aString].
	^TVariableNode new setName: aString