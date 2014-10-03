public
declareModuleName: nameString
	"add the declaration of a module name, version and local/external tag"

	self var: #moduleName declareC: 'var moduleName = "', nameString,' (e)"'.