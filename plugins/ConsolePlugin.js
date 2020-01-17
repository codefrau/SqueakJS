/*
 * This plugin simply adds "console.log" functionality.
 * 
 * Add the following method to the Smalltalk image (to Object for example) to use it:
 * primLog: messageString level: levelString
 *
 *	"Log messageString to the console. The specified level should be one of:
 *		'log'
 *		'info'
 *		'warn'
 *		'error'
 *	"
 *
 * 	<primitive: 'primitiveLog:level:' module: 'ConsolePlugin'>
 *	^ self
 */

function ConsolePlugin() {
  "use strict";

  return {
    getModuleName: function() { return "ConsolePlugin"; },
    interpreterProxy: null,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      return true;
    },

    // Logging
    "primitiveLog:level:": function(argCount) {
      if (argCount !== 2) return false;
      var message = this.interpreterProxy.stackValue(1).bytesAsString();
      var level = this.interpreterProxy.stackValue(0).bytesAsString();
      console[level](message);
      this.interpreterProxy.pop(argCount);	// Answer self
      return true;
    }
  };
}

function registerConsolePlugin() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule("ConsolePlugin", ConsolePlugin());
    } else self.setTimeout(registerConsolePlugin, 100);
};

registerConsolePlugin();
