function SpeechPlugin() {
  'use strict';

  return {
    getModuleName: function() { return 'SpeechPlugin'; },
    interpreterProxy: null,
    primHandler: null,

    voiceInput: null,
    semaphoreIndex: null,
    shouldListen: false,
    recognition: null,
    synth: self.speechSynthesis,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      this.primHandler = this.interpreterProxy.vm.primHandler;
      return true;
    },

    /*
     * Speech Synthesis Primitive
     */

    primitiveSpeak: function(argCount) {
      var text, voice;
      if (argCount === 1) {
        text = this.interpreterProxy.stackValue(0).bytesAsString();
      } else if (argCount === 2) {
        text = this.interpreterProxy.stackValue(1).bytesAsString();
        var voiceName = this.interpreterProxy.stackValue(0).bytesAsString();
        voice = this.synth.getVoices().filter(function(voice) {
            return voice.name === voiceName;
        });
      } else {
        return false;
      }
      var msg = new SpeechSynthesisUtterance(text);
      if (voice && voice.length > 0) { msg.voice = voice[0]; }
      this.synth.speak(msg);
      this.interpreterProxy.pop(argCount);
      return true;
    },

    /*
     * Speech Recognition Primitives
     */

    primitiveRegisterSemaphore: function(argCount) {
      if (argCount !== 1) return false;
      this.semaphoreIndex = this.interpreterProxy.stackIntegerValue(0);
      this.interpreterProxy.pop(argCount);
      return true;
    },

    primitiveUnregisterSemaphore: function(argCount) {
      if (argCount !== 0) return false;
      this.semaphoreIndex = null;
      return true;
    },

    primitiveGetLastRecognitionResult: function(argCount) {
      if (argCount !== 0) return false;
      if (this.semaphoreIndex === null) return false;
      if (this.voiceInput === null) return false;
      var stString = this.primHandler.makeStArray(this.voiceInput);
      this.voiceInput = [];
      this.interpreterProxy.popthenPush(1, stString);
      return true;
    },

    primitiveStartListening: function(argCount) {
      if (argCount !== 0) return false;
      this.recognition = new webkitSpeechRecognition();
      this.recognition.lang = 'en-US'; // en-GB
      this.recognition.interimResults = true;
      // this.recognition.maxAlternatives = 1;
      this.recognition.onresult = this._onRecognitionResult.bind(this);
      this.recognition.onerror = function(event) { console.log(event); };
      /*
       * Imitate `this.recognition.continuous = true` because it is currently
       * only supported by Google Chrome.
       */
      this.recognition.onend = function(event) {
        if (this.shouldListen) {
          this.recognition.start();
        }
      }.bind(this);
      this.shouldListen = true;
      this.recognition.start();
      return true;
    },

    _onRecognitionResult: function(event) {
      this.voiceInput = [];
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        var sqResult = [result.isFinal, []];
        for (var j = 0; j < result.length; j++) {
          var transcript = result[j].transcript;
          var now = Date.now();
          sqResult[1].push([transcript, result[j].confidence]);
        }
        if (sqResult[1].length > 0) {
          this.voiceInput.push(sqResult);
        }
      }
      if (this.semaphoreIndex !== null && this.voiceInput.length > 0) {
        this.primHandler.signalSemaphoreWithIndex(this.semaphoreIndex);
      }
    },

    primitiveStopListening: function(argCount) {
      if (argCount !== 0) return false;
      this.voiceInput = [];
      this.recognition.stop();
      this.shouldListen = false;
      return true;
    },
  };
}

function registerSpeechPlugin() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        if (('webkitSpeechRecognition' in self)) {
          Squeak.registerExternalModule('SpeechPlugin', SpeechPlugin());
        } else {
          console.warn('SpeechPlugin: Web Speech API is not supported by this browser.');
        }
    } else self.setTimeout(registerSpeechPlugin, 100);
};

registerSpeechPlugin();
