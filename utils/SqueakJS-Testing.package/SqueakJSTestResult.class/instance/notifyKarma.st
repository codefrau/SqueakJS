karma
notifyKarma
	(JS at: '__karma__') ifNotNil: [:karma | 
		karma result: {
			'id' -> self foldName.
			'description' -> self title.
			'log' -> {self stack ifNotNil: [:s | s withUnixLineEndings]}.
			'suite' -> #('SqueakJS').
			'success' -> self passed.
			'time' -> self time.
		}]