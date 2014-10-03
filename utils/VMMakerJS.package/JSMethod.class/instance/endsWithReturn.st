inlining support
endsWithReturn
	"Answer true if the last statement of this method is a return."

	^ parseTree statements last isReturn