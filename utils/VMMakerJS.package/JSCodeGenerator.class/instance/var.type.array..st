public
var: varName type: type array: array
"use this in preference to #var:declareC: when possible. This produces a JS statment of the form
var fooArray = [1,2,3]
See also #var:type: for simple var decls" 
	self
		var: varName
		declareC: (String streamContents: [:s |
			s nextPutAll: type.
			s space.
			s nextPutAll: varName.
			s nextPutAll: ' = ['.
			self printArray: array on: s.
			s nextPut: $]])