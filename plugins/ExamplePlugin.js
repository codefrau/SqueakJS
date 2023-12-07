/*
 * This is a template for a SqueakJS plugin
 *
 * The file would need to be imported like the other plugins,
 * see squeak.js
 *
 * The plugin could be used from the image like this:
 *
 *  primXyz: arg1 with: arg2
 *      <primitive: 'primitiveXYZ' module: 'ExamplePlugin'>
 *      ^self primitiveFailed
 */

function ExamplePlugin() {
  "use strict";

  return {
    getModuleName: function() { return 'ExamplePlugin'; },
    interpreterProxy: null,
    primHandler: null,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      this.primHandler = this.interpreterProxy.vm.primHandler;
      return true;
    },

    primitiveXYZ: function(argCount) {
        if (argCount !== 2) return false;
        var arg1 = this.interpreterProxy.stackObjectValue(1);
        var arg2 = this.interpreterProxy.stackIntegerValue(0);
        if (this.interpreterProxy.failed()) return false;
        // see vm.interpreter.proxy.js for available proxy methods
        var result = this.doSomething(arg1, arg2);
        this.interpreterProxy.popthenPush(argCount + 1, result);
        return true;
    },
  };
}

function registerExamplePlugin() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule('ExamplePlugin', ExamplePlugin());
    } else self.setTimeout(registerExamplePlugin, 100);
};

registerExamplePlugin();
