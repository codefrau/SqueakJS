specifying primitives
handlePrimitiveDirective: aStmt on: sStream

	isPrimitive := true.
	fullArgs := args.
	locals addAll: args.
	args := OrderedCollection new.
	fullArgs with: parmSpecs do:
		[:argName :spec |
			declarations
				at: argName
				put: (spec jscgDeclareJSForVar: argName)].
	aStmt isAssignment ifTrue:
		[declarations
			at: aStmt variable name
			put: (rcvrSpec jscgDeclareJSForVar: aStmt variable name).
		 sStream nextPutAll: (self
			statementsFor:
				(rcvrSpec
					jscg:	JSSmartSyntaxPluginCodeGenerator new
					prolog:  [:expr | aStmt variable name, ' := ', expr]
					expr: 	aStmt variable name
					index: 	(fullArgs size))
			varName: '')].

	"only add the failure guard if there are args or it is an assignment"
	(fullArgs isEmpty not or:[aStmt isAssignment]) ifTrue:[self generateFailureGuardOn: sStream].
	^true.
