callbacks
handleCallback
	| block args result |
	block := self primGetActiveCallbackBlock.
	args := self primGetActiveCallbackArgs.
	[result := block valueWithArguments: args]
		ifError: [:err :rcvr | result := JS Error: err asString].
	self primReturnFromCallback: result.
