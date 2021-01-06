/*
 * This plugin is only here for retrieving the current working directory (for finding .changes and .sources files)
 */

function UnixOSProcessPlugin() {
  "use strict";

  return {
    getModuleName: function() { return 'UnixOSProcessPlugin'; },
    interpreterProxy: null,
    primHandler: null,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      this.primHandler = this.interpreterProxy.vm.primHandler;
      return true;
    },

    primitiveGetCurrentWorkingDirectory: function(argCount) {
      this.interpreterProxy.popthenPush(argCount + 1, this.primHandler.makeStString(require("process").cwd()));
      return true;
    },
  };
}

function registerUnixOSProcessPlugin() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule('UnixOSProcessPlugin', UnixOSProcessPlugin());
    } else setTimeout(registerUnixOSProcessPlugin, 100);
};

registerUnixOSProcessPlugin();
