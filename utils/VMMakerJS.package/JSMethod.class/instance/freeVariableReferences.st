utilities
freeVariableReferences
	"Answer a collection of variables referenced this method, excluding locals, arguments, and pseudovariables."

	| refs |
	refs := Set new.
	parseTree nodesDo: [ :node |
		node isVariable ifTrue: [ refs add: node name asString ].
	].
	args do: [ :var | refs remove: var asString ifAbsent: [] ].
	locals do: [ :var | refs remove: var asString ifAbsent: [] ].
	#('self' 'nil' 'true' 'false') do: [ :var | refs remove: var ifAbsent: [] ].
	^ refs asSortedCollection