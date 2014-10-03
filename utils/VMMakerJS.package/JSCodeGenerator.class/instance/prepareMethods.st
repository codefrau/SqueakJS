utilities
prepareMethods
	"Prepare methods for browsing."

	| globals |
	globals := Set new: 200.
	globals addAll: variables.
	methods do: [ :m |
		(m locals, m args) do: [ :var |
			(globals includes: var) ifTrue: [
				self error: 'Local variable name may mask global when inlining: ', var.
			].
			(methods includesKey: var) ifTrue: [
				self error: 'Local variable name may mask method when inlining: ', var.
			].	
		].
		m mapReceiversIn: receiverDict.
		m bindClassVariablesIn: constants.
		m prepareMethodIn: self.
	].