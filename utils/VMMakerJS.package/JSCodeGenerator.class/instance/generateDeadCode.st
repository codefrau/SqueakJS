accessing
generateDeadCode
	"Answer whether we should generate 'dead code' branches. This can be useful for hacking the VM when used in conjunction with #useSymbolicConstants, e.g., for code like:
		DoAssertionChecks ifTrue:[
			...
		].

	we will generate

		#define DoAssertionChecks 0
		...
		if(DoAssertionChecks) {
			...
		}.

	allowing us to change the #define (or redefine it as a variable) for later use."
	^generateDeadCode