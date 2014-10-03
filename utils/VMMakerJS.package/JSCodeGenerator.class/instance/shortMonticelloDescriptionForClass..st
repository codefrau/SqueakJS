JS code generator
shortMonticelloDescriptionForClass: aClass
	"Answer a suitable Monticello package stamp to include in a moduleName."
	| mdesc |
	mdesc := [self monticelloDescriptionFor: aClass]
				on: Error
				do: [:ex| ^' ', Date today asString].
	^mdesc copyFrom: 1 to: (mdesc indexOfSubCollection: ' uuid:') - 1