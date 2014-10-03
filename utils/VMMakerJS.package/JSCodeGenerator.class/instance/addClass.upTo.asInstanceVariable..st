composition
addClass: aClass upTo: aSuperclass asInstanceVariable: varName
	"For an instance variable var in one of the classes that has been added to
	this code generator, assume that an instance of aClass would normally be
	assigned to that variable. Arrange for the methods in aClass and all superclasses
	up to but not including aSuperclass to be incorporated into the generated C source
	module as if they had been methods in the class with instance variable var.
	
	n.b. See #addStructureClass: mechanism in Cog."

	| cls |
	cls := aClass.
	[cls == aSuperclass]
		whileFalse: [self addClass: cls.
				self mapVar: varName asInstanceOf: cls to: 'self'.
				cls := cls superclass]
