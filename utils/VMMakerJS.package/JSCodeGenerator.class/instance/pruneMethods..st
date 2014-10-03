inlining
pruneMethods: selectorList
	"Explicitly prune some methods"
	selectorList do:[:sel| methods removeKey: sel ifAbsent:[]].