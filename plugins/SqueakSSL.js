/*
 * This is a fake SSL plugin, actual authentication and crypto
 * is handled by browser and SocketPlugin
 */

function SqueakSSL() {
  "use strict";

  return {
    getModuleName: function() { return 'SqueakSSL (fake)'; },
    interpreterProxy: null,
    primHandler: null,

    handleCounter: 0,

    // Return codes from the core SSL functions
    SQSSL_OK: 0,
    SQSSL_NEED_MORE_DATA: -1,
    SQSSL_INVALID_STATE: -2,
    SQSSL_BUFFER_TOO_SMALL: -3,
    SQSSL_INPUT_TOO_LARGE: -4,
    SQSSL_GENERIC_ERROR: -5,
    SQSSL_OUT_OF_MEMORY: -6,
    // SqueakSSL getInt/setInt property IDs
    SQSSL_PROP_VERSION:  0,
    SQSSL_PROP_LOGLEVEL: 1,
    SQSSL_PROP_SSLSTATE: 2,
    SQSSL_PROP_CERTSTATE: 3,
    // SqueakSSL getString/setString property IDs
    SQSSL_PROP_PEERNAME: 0,
    SQSSL_PROP_CERTNAME: 1,
    SQSSL_PROP_SERVERNAME: 2,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      this.primHandler = this.interpreterProxy.vm.primHandler;
      return true;
    },

    primitiveCreate: function(argCount) {
      var name = '{SqueakJS SSL #' + (++this.handleCounter) + '}';
      var sqHandle = this.primHandler.makeStString(name);
      sqHandle.handle = true;
      this.interpreterProxy.popthenPush(argCount + 1, sqHandle);
      return true;
    },

    primitiveConnect: function(argCount) {
      if (argCount !== 5) return false;
      this.interpreterProxy.popthenPush(argCount + 1, 0);
      return true;
    },

    primitiveDestroy: function(argCount) {
      if (argCount !== 1) return false;
      this.interpreterProxy.popthenPush(argCount + 1, 1); // Non-zero if successful
      return true;
    },

    primitiveGetIntProperty: function(argCount) {
      if (argCount !== 2) return false;
      var handle = this.interpreterProxy.stackObjectValue(1).handle;
      if (handle === undefined) return false;
      var propID = this.interpreterProxy.stackIntegerValue(0);

      var res;
      if (propID === this.SQSSL_PROP_CERTSTATE) {
        res = this.SQSSL_OK; // Always valid
      } else {
        res = 0;
      }
      this.interpreterProxy.popthenPush(argCount + 1, res);
      return true;
    },

    primitiveGetStringProperty: function(argCount) {
      if (argCount !== 2) return false;
      var handle = this.interpreterProxy.stackObjectValue(1).handle;
      if (handle === undefined) return false;
      var propID = this.interpreterProxy.stackIntegerValue(0);

      var res;
      if (propID === this.SQSSL_PROP_PEERNAME) {
        res = this.primHandler.makeStString('*'); // Match all
      } else {
        res = this.interpreterProxy.nilObject();
      }
      this.interpreterProxy.popthenPush(argCount + 1, res);
      return true;
    },

    primitiveEncrypt: function(argCount) {
      if (argCount !== 5) return false;
      var handle = this.interpreterProxy.stackObjectValue(4).handle;
      if (handle === undefined) return false;
      var srcBuf = this.interpreterProxy.stackObjectValue(3);
      var start = this.interpreterProxy.stackIntegerValue(2) - 1;
      var length = this.interpreterProxy.stackIntegerValue(1);
      var dstBuf = this.interpreterProxy.stackObjectValue(0);
      dstBuf.bytes = srcBuf.bytes; // Just copy all there is
      this.interpreterProxy.popthenPush(argCount + 1, length);
      return true;
    },

    primitiveDecrypt: function(argCount) {
      if (argCount !== 5) return false;
      var handle = this.interpreterProxy.stackObjectValue(4).handle;
      if (handle === undefined) return false;
      var srcBuf = this.interpreterProxy.stackObjectValue(3);
      var start = this.interpreterProxy.stackIntegerValue(2) - 1;
      var length = this.interpreterProxy.stackIntegerValue(1);
      var dstBuf = this.interpreterProxy.stackObjectValue(0);
      dstBuf.bytes = srcBuf.bytes; // Just copy all there is
      this.interpreterProxy.popthenPush(argCount + 1, length);
      return true;
    }
  };
}

function registerSqueakSSL() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule('SqueakSSL', SqueakSSL());
    } else self.setTimeout(registerSqueakSSL, 100);
};

registerSqueakSSL();
