utilities
localizeGlobalVariables
	| candidates procedure |

	"find all globals used in only one method"
	candidates := globalVariableUsage select: [:e | e size = 1].
	(candidates keys select: [:k| vmClass mustBeGlobal: k]) do:
		[:k| candidates removeKey: k].
	variables removeAllFoundIn: candidates keys.

	"move any suitable global to be local to the single method using it"
	candidates keysAndValuesDo: [:key :targets | 
		targets do: [:name |
			procedure := methods at: name.
			procedure locals add: key.
			variableDeclarations at: key ifPresent: [:v | 
				procedure declarations at: key put: v.
				variableDeclarations removeKey: key]]].