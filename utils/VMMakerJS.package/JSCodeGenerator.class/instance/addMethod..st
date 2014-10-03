utilities
addMethod: aJSMethod
	"Add the given method to the code base."

	(methods includesKey:  aJSMethod selector) ifTrue: [
		self error: 'Method name conflict: ', aJSMethod selector.
	].
	methods at: aJSMethod selector put: aJSMethod.