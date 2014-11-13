utilities
translateAllPluginsIn: aDirectory
	self beActiveDuring: [
		#(	ADPCMCodecPlugin
			BalloonEnginePlugin
			"BMPReadWriterPlugin	-- not working yet"
			BitBltSimulation
			"DSAPlugin			--not working yet"
			DeflatePlugin
			FFTPlugin
			FloatArrayPlugin
			GeniePlugin		"-- not working yet"
			JPEGReaderPlugin
			KedamaPlugin
			KedamaPlugin2
			KlattSynthesizerPlugin
			LargeIntegersPlugin
			Matrix2x3Plugin
			MiscPrimitivePlugin
			ScratchPlugin
			SoundGenerationPlugin
			StarSqueakPlugin
		) do: [:pluginName |
			self environment at: pluginName ifPresent: [:plugin |
				plugin translateInDirectory: aDirectory doInlining: false]]
		displayingProgress: 'Generating JS plugins'].