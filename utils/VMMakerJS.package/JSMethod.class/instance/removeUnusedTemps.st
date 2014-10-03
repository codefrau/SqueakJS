utilities
removeUnusedTemps
	"Remove all of the unused temps in this method. Answer a bag (why the hell a bag???) with the references."
	"After inlining some variable references are now obsolete, we could fix them there but the 
	code seems a bit complicated, the other choice to to rebuild the locals before extruding. This is done here"
	| refs |
	refs := Bag new.
	"find all the variable names referenced in this method"
	parseTree nodesDo: [ :node |
		node isVariable ifTrue: [ refs add: node name asString ].
		node isStmtList ifTrue: [refs addAll: node args]].
	"add all the non-arg declarations (might be variables usedonly in cCode sections)"
	refs addAll:((self declarations keys) reject: [:e | self args includes: e]).
	"reset the locals to be only those still referred to"
	locals := locals select: [:e | refs includes: e].
	^refs
