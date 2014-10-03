transformations
extractStaticDirective
	"Scan the top-level statements for an inlining directive of the form:

		self static: <boolean>

	and remove the directive from the method body. Answer the argument of the
	directive. If there is no static directive, answer true if this is an api method,
	otherwise answer nil for undefined. The code generator may determine the
	static declaration when undefined."

	^self
		extractDirective: #static:
		valueBlock: [:sendNode| sendNode args first value ~= false]
		default: (((properties includesKey: #api) or: [properties includesKey: #api:])
					ifTrue: [false] "api methods cannot be declared static"
					ifFalse: [nil]) "undefined, defer to the code generator for default"