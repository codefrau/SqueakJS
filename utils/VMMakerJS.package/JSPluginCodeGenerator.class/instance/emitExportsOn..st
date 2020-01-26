JS code generator
emitExportsOn: aStream
	"Store all the exported primitives in a form to be used by internal plugins"
	aStream nextPutAll:'

function registerPlugin() {
	if (typeof Squeak === "object" && Squeak.registerExternalModule) {
		Squeak.registerExternalModule("', pluginName,'", {'.

	self exportedPrimitiveNames do:[:primName|
		aStream crtab: 3;
			nextPutAll: primName; 
			nextPutAll: ': '; 
			nextPutAll: primName;
			nextPutAll:','.
	].

aStream nextPutAll: '
		});
	} else self.setTimeout(registerPlugin, 100);
}

registerPlugin();

})(); // Register module/plugin
'.
