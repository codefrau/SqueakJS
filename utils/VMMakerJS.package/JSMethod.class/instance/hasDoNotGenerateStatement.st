inlining support
hasDoNotGenerateStatement
	"True if method has a #doNotGenerate statement, equivalent to pragma <doNotGenerate>
	or if it has a #subclassResponsibility statement."
	parseTree statements
		detect: [:stmt | stmt isSend
					and: [stmt selector = #doNotGenerate
						or: [stmt selector = #subclassResponsibility]]]
		ifNone: [^ false].
	^ true