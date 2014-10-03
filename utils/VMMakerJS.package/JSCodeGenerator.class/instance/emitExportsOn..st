JS code generator
emitExportsOn: aStream
	"Store all the exported primitives in a form to be used by the internal named prim system"
	aStream nextPutAll:'

void* vm_exports[][3] = {'.
	self exportedPrimitiveNames do:[:primName|
		aStream cr;
			nextPutAll:'	{"", "'; 
			nextPutAll: primName; 
			nextPutAll:'", (void*)'; 
			nextPutAll: primName;
			nextPutAll:'},'.
	].
	aStream nextPutAll:'
	{NULL, NULL, NULL}
};
'.