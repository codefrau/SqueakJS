JS code generator
emitJSCodeOn: aStream doAssertions: assertionFlag
	"Emit C code for all methods in the code base onto the given stream. All inlined method calls should already have been expanded."

	self emitJSHeaderOn: aStream.
	self emitJSTypesOn: aStream.
	self emitJSConstantsOn: aStream.
	self emitJSVariablesOn: aStream.
"'Writing Translated Code...'
displayProgressAt: Sensor cursorPoint
from: 0 to: methods size
during: [:bar |"
	preparedMethodList doWithIndex: [ :m :i | "bar value: i."
		m emitJSCodeOn: aStream generator: self].
"]."
	self emitExportsOn: aStream.
