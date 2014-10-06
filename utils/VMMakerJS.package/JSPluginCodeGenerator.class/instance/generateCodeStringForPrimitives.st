public
generateCodeStringForPrimitives
"TPR - moved down from JSCodeGenerator"
	| s methodList |
	s := ReadWriteStream on: (String new: 1000).
	methodList := methods asSortedCollection: [:m1 :m2 | m1 selector < m2 selector].
	self emitJSHeaderOn: s.
	self emitJSConstantsOn: s.
	self emitJSVariablesOn: s.
	methodList do: [:m | m emitJSCodeOn: s generator: self].
	self emitExportsOn: s.
	^ s contents
