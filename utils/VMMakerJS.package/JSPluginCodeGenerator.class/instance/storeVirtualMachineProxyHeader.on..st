private
storeVirtualMachineProxyHeader: categoryList on: fileName
	"Store the interpreter definitions on the given file"
	| stream |
	stream := FileStream newFileNamed: fileName.
	stream nextPutAll:
'#ifndef _SqueakVM_H
#define _SqueakVM_H

/* Increment the following number if you change the order of
   functions listed or if you remove functions */
#define VM_PROXY_MAJOR 1

/* Increment the following number if you add functions at the end */
#define VM_PROXY_MINOR 0

typedef struct VirtualMachine {
	int (*minorVersion) (void);
	int (*majorVersion) (void);
'.

	categoryList do:[:assoc|
		stream cr; crtab; nextPutAll:'/* InterpreterProxy methodsFor: ''',assoc key, ''' */'; cr; crtab.
		assoc value asSortedCollection do:[:sel|
			(methods at: sel) emitProxyFunctionPrototype: stream generator: self.
			stream nextPutAll: ';'; crtab]].

	stream nextPutAll:'
} VirtualMachine;

#endif /* _SqueakVM_H */
'.
	stream close.