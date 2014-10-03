inlining
inlineCaseStatementBranchesInMethodNamed: selector localizingVars: varsList 
	"Inline case statement branches in the method with the given name."
	(self methodNamed: selector)
		ifNotNilDo: [:m | m inlineCaseStatementBranchesIn: self localizingVars: varsList]