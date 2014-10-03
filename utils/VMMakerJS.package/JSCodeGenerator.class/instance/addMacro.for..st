public
addMacro: aString for: selector
	"Add a macro. aString must be the macro arguments and body without the leading #define or name"
	macros at: selector put: aString