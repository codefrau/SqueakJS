primitive compilation
replaceSizeMessages
	"Replace sends of the message 'size' with calls to sizeOfSTArrayFromCPrimitive."

	| argExpr |
	parseTree nodesDo: [:n |
		(n isSend and: [n selector = #size]) ifTrue: [
			argExpr := TSendNode new
				setSelector: #+
				receiver: n receiver
				arguments: (Array with: (TConstantNode new setValue: 1)).
			n
				setSelector: #sizeOfSTArrayFromCPrimitive:
				receiver: (TVariableNode new setName: self vmNameString)
				arguments: (Array with: argExpr)]].
