running
runCase: aTestCase
	| result |
	result := SqueakJSTestResult new testCase: aTestCase; yourself.
	result time: (SmalltalkCI timeToRun: [
		[ aTestCase runCase ]
			on: Halt , Error, TestFailure
			do: [ :err |
				result testError: err.
				aTestCase shouldPass ifTrue: [self serializeError: result testError of: aTestCase].
				result stack: (self stackTraceString: err of: aTestCase) ] ]).
	result notifyKarma.
	(results at: aTestCase class ifAbsentPut: [ OrderedCollection new ])
		add: result