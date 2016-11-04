running
runAll
	(JS at: '__karma__') ifNotNil: [:karma | 
		karma info: {
			'total' -> suite tests size.
		}].
	super runAll