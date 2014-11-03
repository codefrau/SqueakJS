JS translation
generateJSCodeForCcode: cCode on: aStream indent: level
	cCode = '' ifTrue: [^self].
	aStream nextPutAll: (cCodeTranslationDict at: cCode ifAbsent: [
		(#('sqrt' 'sin' 'cos' 'tan' 'atan' 'atan2' 'log' 'exp' 'min' 'max' 'floor') anySatisfy: [:fn | fn,'(*)' match: cCode])
			ifTrue: ['Math.', cCode] ifFalse: [
		('opTable[*] = (void *)*' match: cCode)
			ifTrue: [cCode copyReplaceAll: '(void *)' with: ''] ifFalse: [
		('fn(*Handle, &*Pitch, *)' match: cCode)
			ifTrue: [(cCode copyReplaceAll: '&' with: 'function(p){') copyReplaceAll: 'Pitch' with: 'Pitch = p}'] ifFalse: [
		(' ((*)querySurfaceFn)*(handle, &destWidth, &destHeight, &destDepth, &destMSB)' match: cCode)
			ifTrue: [ 'querySurfaceFn(handle, function(w, h, d, m){destWidth = w; destHeight = h; destDepth = d; destMSB = m; })'] ifFalse: [
		(' ((*)querySurfaceFn)*(handle, &sourceWidth, &sourceHeight, &sourceDepth, &sourceMSB)' match: cCode)
			ifTrue: [ 'querySurfaceFn(handle, function(w, h, d, m){sourceWidth = w; sourceHeight = h; sourceDepth = d; sourceMSB = m; })'] ifFalse: [
		(#('fn(destHandle, affectedL, affectedT, affectedR-affectedL, affectedB-affectedT)',
			'fn(sourceHandle, 0, 0, 0, 0)') includes: cCode)
			ifTrue: [cCode] ifFalse: [
		"See initializeCTranslationDictionary"
		self error: 'C: ' , cCode]]]]]]])
