utilities
sortMethods: aJSMethodCollection
	"We need to define this since different Squeak versions answer different results
	 for asSortedCollection and if sort order changes, generated code changes too."
	^aJSMethodCollection asSortedCollection:
		[:a :b| a selector caseSensitiveLessOrEqual: b selector]