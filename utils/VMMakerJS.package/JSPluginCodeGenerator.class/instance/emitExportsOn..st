JS code generator
emitExportsOn: aStream
	"Store all the exported primitives in a form to be used by internal plugins"
	aStream nextPutAll:'

Squeak.registerExternalModule("', pluginName,'", {'.

	self exportedPrimitiveNames do:[:primName|
		aStream crtab: 1;
			nextPutAll: primName; 
			nextPutAll: ': '; 
			nextPutAll: primName;
			nextPutAll:','.
	].

aStream nextPutAll: '
});

}); // end of module
'.
