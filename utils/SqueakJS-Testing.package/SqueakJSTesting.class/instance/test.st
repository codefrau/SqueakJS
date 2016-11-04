executing
test
	| runner |
	self prepareForTesting.
	self isCoverageTestingEnabled
		ifTrue: [ self class codeCoverageClass
					run: [ runner := self runTests ]
					spec: self spec
					in: self projectDirectory ]
		ifFalse: [ runner := self runTests ] .
	(JS at: '__karma__') ifNotNil: [:karma |
		"..."
	] ifNil: [
		self reportResults: runner.
		SmalltalkCI shutdown: runner isSuccessful.
	]
