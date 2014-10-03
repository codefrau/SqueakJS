JS code generator
emitVmmVersionOn: aStream
	"Emit a version string macro suitable for identifying source code version
	of this interpreter. This is expected to be used in conjunction with a similar
	identifier for platform source code version, such the the VM can identify
	the source code version for its platform source and matching VMMaker source."

	aStream nextPutAll: '#define VMMAKER_VERSION "';
		nextPutAll: VMMaker versionString;
		nextPut: $";
		cr
