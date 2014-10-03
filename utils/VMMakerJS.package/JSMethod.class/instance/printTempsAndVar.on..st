private
printTempsAndVar: varName on: aStream 
	"add the required temps and the varname to the stream"
	aStream nextPutAll: '| rcvr stackPointer successFlag ' , varName , ' |';
	 cr