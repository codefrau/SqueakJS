function CroquetPlugin() {
  "use strict";

  return {
    getModuleName: function() { return "CroquetPlugin"; },
    interpreterProxy: null,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      return true;
    },

    primitiveGatherEntropy: function(argCount) {
      var rcvr = this.interpreterProxy.stackObjectValue(0);
      if (this.interpreterProxy.failed()) {
        return null;
      }
      if (!rcvr.isBytes()) {
        return this.interpreterProxy.primitiveFail();
      }
      window.crypto.getRandomValues(rcvr.bytes);
      this.interpreterProxy.popthenPush(argCount + 1, this.interpreterProxy.trueObject());
      return true;
    },
  };
}

function registerCroquetPlugin() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule("CroquetPlugin", CroquetPlugin());
    } else self.setTimeout(registerCroquetPlugin, 100);
};

registerCroquetPlugin();
