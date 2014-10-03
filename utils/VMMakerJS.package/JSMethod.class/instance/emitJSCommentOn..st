JS code generation
emitJSCommentOn: aStream
	"Emit the transferred Smalltalk comments as C comments."

	comment ifNotNil: [
		aStream cr;cr.
		1 to: comment size do: [:index | 
			aStream 
				nextPutAll: '/*'; tab;
				nextPutAll: (comment at: index);
				nextPutAll: ' */';
				cr]]