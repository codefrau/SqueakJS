callbacks
initCallbacks
	CallbackProcess ifNotNil: [CallbackProcess terminate. CallbackProcess := nil].
	CallbackSemaphore := Semaphore new.
	self primInitCallbacks: (Smalltalk registerExternalObject: CallbackSemaphore).
	CallbackProcess := [self callbackProcess] newProcess
		priority: Processor lowIOPriority; resume.
