promises
await: promise
	"Pause the current process until promise returns, signal an exception if the promise was rejected"
	| sem result isError |
	isError := false.
	sem := Semaphore new.
	promise
		then: [:value |
			result := value.
			sem signal];
		catch: [:error |
			result := error.
			isError := true.
			sem signal].
	sem wait.
	isError ifTrue: [JSException error: result].
	^result