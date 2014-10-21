*vmmakerjs
isFloatIn: aCodeGen
	| type |
	type := aCodeGen typeOfVariable: name.
	type isNil ifTrue: [^false].
	(type includes: $*) ifTrue: [^false].
	(type beginsWithAnyOf: #('register ' 'static ')) ifTrue: [type := type copyAfter: $ ].
	(type beginsWithAnyOf: #('double ' 'float ')) ifTrue: [^true].
	(type beginsWithAnyOf: #('int ' 'unsigned ' 'sqInt ' 'usqInt ' 'var ')) ifTrue: [^false].
	self halt: 'need to handle ', type