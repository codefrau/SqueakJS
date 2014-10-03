JS code generator
monticelloDescriptionFor: aClass
	"Answer a suitable Monticello package stamp to include in the header."
	| pkgInfo pkg uuid |
	pkgInfo := PackageOrganizer default packageOfClass: aClass.
	pkg := MCWorkingCopy allManagers detect: [:ea| ea packageName = pkgInfo packageName].
	pkg ancestry ancestors isEmpty ifFalse:
		[uuid := pkg ancestry ancestors first id].
	^aClass name, (pkg modified ifTrue: [' * '] ifFalse: [' ']), pkg ancestry ancestorString, ' uuid: ', uuid asString