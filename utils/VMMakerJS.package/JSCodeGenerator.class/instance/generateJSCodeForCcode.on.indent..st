JS translation
generateJSCodeForCcode: cCode on: aStream indent: level
	cCode = '' ifTrue: [^self].
	aStream nextPutAll: (cCodeTranslationDict at: cCode ifAbsent: [
		"See initializeCTranslationDictionary"
		self error: 'C: ' , cCode]).
