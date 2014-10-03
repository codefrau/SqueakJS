utilities
removeMethodForSelector: aSelector
	"Remove the given method from the code base"
	methods removeKey:  aSelector ifAbsent: []