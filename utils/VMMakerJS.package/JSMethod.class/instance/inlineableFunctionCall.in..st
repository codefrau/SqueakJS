inlining
inlineableFunctionCall: aNode in: aCodeGen
	"Answer true if the given send node is a call to a 'functional' method--a method whose body is a single return statement of some expression and whose actual parameters can all be directly substituted."

	| m |
	aNode isSend ifFalse: [ ^false ].
	m := aCodeGen methodNamed: aNode selector.  "nil if builtin or external function"
	((m ~= nil) and: [m isFunctional and: [aCodeGen mayInline: m selector]]) ifTrue: [
		aNode args do: [ :a | (self isSubstitutableNode: a intoMethod: m in: aCodeGen) ifFalse: [ ^false ]].
		^true
	] ifFalse: [
		^false
	].