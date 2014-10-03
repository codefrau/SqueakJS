translating builtins
generateDebugCode: aNode on: aStream indent: level 
	"Generate the C debug code for this message onto the given stream, if  
	compiled in debugMode."
	self generateDebugCode
		ifTrue: 
			[aStream nextPutAll: '// DebugCode...';
			 cr.
			aNode args first
				emitJSCodeOn: aStream
				level: level
				generator: self.
			aStream tab: level.
			aStream nextPutAll: '// ...DebugCode']
		ifFalse: [aStream nextPutAll: '// missing DebugCode']