public
var: varName type: type array: array
"use this in preference to #var:declareC: when possible. This produces a C statment of the form
int * fooArray[]={1,2,3}
See also #var:type: for simple var decls" 
	self
		var: varName
		declareC: (String streamContents: [:s |
			s nextPutAll: type.
			s space.
			s nextPutAll: varName.
			s nextPutAll: '[] = {'.
			self printArray: array on: s.
			s nextPut: $}])