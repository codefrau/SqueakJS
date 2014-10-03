private
printTempsAndVar: varName on: aStream 
	"add the required temps and the varname to the stream"
	aStream nextPutAll: '| '.
	(#('rcvr' 'stackPointer' 'successFlag' 'interpreterProxy' ) reject: [:each | locals includes: each])
		do: [:each | aStream nextPutAll: each;
			 space].
	(locals reject: [:each | each first = $_])
		do: [:each | aStream nextPutAll: each;
			 space].
"don't add varName twice. Probably a deeper reason for this, but WTH. TPR"
	(locals includes: varName) ifFalse:[aStream nextPutAll: varName].
	aStream nextPutAll: '|';
	 cr