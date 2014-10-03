transformations
extractExpandCaseDirective
	"Scan the top-level statements for an inlining directive of the form:
		self expandCases
	 and remove the directive from the method body. Answer whether
	 there was such a directive."

	^self
		extractDirective: #expandCases
		valueBlock: [:sendNode| true]
		default: false