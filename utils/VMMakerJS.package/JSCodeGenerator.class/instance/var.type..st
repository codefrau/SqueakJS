public
var: varName type: type
"Use this in preference to #var:declareC: whenver possible since it avoids typing the varname twice and thus avoids the potential for a typo. See also #var:type:array:"
	self var: varName declareC: type , ' ' , varName