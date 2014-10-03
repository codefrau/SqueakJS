inlining support
addVarsDeclarationsAndLabelsOf: methodToBeInlined
	"Prepare to inline the body of the given method into the receiver by making the args and locals of the argument to the receiver be locals of the receiver. Record any type declarations for these variables. Record labels. Assumes that the variables have already be renamed to avoid name clashes."

	methodToBeInlined args, methodToBeInlined locals do: [ :v |
		(locals includes: v) ifFalse: [ locals addLast: v ].
	].
	methodToBeInlined declarations associationsDo: [ :assoc |
		declarations add: assoc.
	].
	methodToBeInlined labels do: [ :label |
		labels add: label.
	].