private
with: argument retry: retryBlock
	| error |
	(error := self primGetError) ifNil: [^ self error: 'JSBridge error'].
	(error beginsWith: 'asJSArgument') ifTrue: [
		^retryBlock value: argument asJSArgument].
	(error beginsWith: 'CallbackSemaphore') ifTrue: [
		self class initCallbacks.
		^retryBlock value: argument].
	self error: error.
