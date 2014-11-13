public
translatedMethodsB2DPlugin
	"see senders of translatedMethods"
	^{
		#makeUnsignedFrom: -> #generateMakeUnsignedFrom:on:indent:.
		#loadPointIntAt:from: -> #generateLoadPointInt:on:indent:.
		#loadPointShortAt:from: -> #generateLoadPointShort:on:indent:.
	}