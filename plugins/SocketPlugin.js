function SocketPlugin() {

  return {
    getModuleName() { return 'SocketPlugin with support for web requests'; },
    interpreterProxy: null,
    primHandler: null,

    handleCounter: 0,

    // DNS Lookup
    LastLookup: null,

    // Constants
    TCP_Socket_Type: 0,
    Resolver_Uninitialized: 0,
    Resolver_Ready: 1,
    Resolver_Busy: 2,
    Resolver_Error: 3,
    Socket_InvalidSocket: -1,
    Socket_Unconnected: 0,
    Socket_WaitingForConnection: 1,
    Socket_Connected: 2,
    Socket_OtherEndClosed: 3,
    Socket_ThisEndClosed: 4,

    setInterpreter(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      this.primHandler = this.interpreterProxy.vm.primHandler;
      return true;
    },

    // A socket handle emulates socket behavior
    _newSocketHandle() {
      var that = this;
      return {
        host: null,
        port: null,

        response: null,
        responseIndex: 0,
        responseLength: 0,

        status: that.Socket_Unconnected,

        connect(host, port) {
          this.host = host;
          this.port = port;
          this.status = that.Socket_Connected;
        },

        close() {
          if (this.status == that.Socket_Connected ||
              this.status == that.Socket_OtherEndClosed ||
              this.status == that.Socket_WaitingForConnection) {
            this.status = that.Socket_Unconnected;
          }
        },

        destroy() {
          this.status = that.Socket_InvalidSocket;
        },

        recv(count) {
          var oldIndex = this.responseIndex;
          this.responseIndex += count;
          return this.response.slice(oldIndex, oldIndex + count);
        },

        send(request) {
          // Split header lines and parse first line
          var firstLineItems = request.split('\n')[0].split(' ');
          var httpMethod = firstLineItems[0];
          if (httpMethod !== 'GET') return -1;
          var targetURL = firstLineItems[1];

          var url = 'http://' + this.host + ':' + this.port + targetURL;

          var httpRequest = new XMLHttpRequest();
          httpRequest.open(httpMethod, url);
          httpRequest.responseType = "arraybuffer";

          var that = this;
          httpRequest.onload = function (oEvent) {
            var content = this.response;
            if (content) {
              // Fake header
              var header = new TextEncoder('utf-8').encode(
                'HTTP/1.0 ' + this.status + ' OK\r\n' +
                'Server: SqueakJS SocketPlugin Proxy\r\n' +
                'Content-Length: ' + content.byteLength + '\r\n\r\n');

              // Merge fake header with content
              that.response = new Uint8Array(header.byteLength + content.byteLength);
              that.response.set(header, 0);
              that.response.set(new Uint8Array(content), header.byteLength);
              that.responseLength = that.response.byteLength;
            }
          };

          httpRequest.onerror = function(e) {
            console.warn('Retrying with CORS proxy: ' + url);
            var proxy = 'https://crossorigin.me/',
                retry = new XMLHttpRequest();
            retry.open(httpMethod, proxy + url);
            retry.responseType = httpRequest.responseType;
            retry.onload = httpRequest.onload;
            retry.onerror = function() {alert("Failed to download:\n" + url);};
            retry.send();
          };

          httpRequest.send(null);
          return request.length;
        },

        can_read() {
          if (this.response === null) return false; // response not ready (yet)
          if (this.status == that.Socket_Connected &&
              this.responseIndex < this.responseLength) {
              return true;
          }
          return false;
        }
      };
    },

    primitiveHasSocketAccess(argCount) {
      return true;
    },

    primitiveInitializeNetwork(argCount) {
      this.interpreterProxy.pop(1);
      return true;
    },

    primitiveResolverNameLookupResult(argCount) {
      if (argCount !== 0) return false;
      var inet;
      if (this.LastLookup !== null) {
        inet = this.primHandler.makeStString(this.LastLookup);
        this.LastLookup = null;
      } else {
        inet = this.interpreterProxy.nilObject();
      }
      this.interpreterProxy.popthenPush(1, inet);
      return true;
    },

    primitiveResolverStartNameLookup(argCount) {
      if (argCount !== 1) return false;
      this.LastLookup = this.interpreterProxy.stackValue(0).bytesAsString();
      this.interpreterProxy.popthenPush(1, this.interpreterProxy.nilObject());
      return true;
    },

    primitiveResolverStatus(argCount) {
      this.interpreterProxy.popthenPush(1, this.Resolver_Ready);
      return true;
    },

    primitiveSocketConnectionStatus(argCount) {
      if (argCount !== 1) return false;
      var handle = this.interpreterProxy.stackObjectValue(0).handle;
      var status = handle.status;
      if (status === undefined) status = this.Socket_InvalidSocket;
      this.interpreterProxy.popthenPush(1, status);
      return true;
    },

    primitiveSocketConnectToPort(argCount) {
      if (argCount !== 3) return false;
      var handle = this.interpreterProxy.stackObjectValue(2).handle;
      if (handle === undefined) return false;
      var host = this.interpreterProxy.stackObjectValue(1).bytesAsString();
      var port = this.interpreterProxy.stackIntegerValue(0);
      handle.connect(host, port);
      this.interpreterProxy.popthenPush(argCount,
                                        this.interpreterProxy.nilObject());
      return true;
    },

    primitiveSocketCloseConnection(argCount) {
      if (argCount !== 1) return false;
      var handle = this.interpreterProxy.stackObjectValue(0).handle;
      if (handle === undefined) return false;
      handle.close();
      this.interpreterProxy.popthenPush(1, this.interpreterProxy.nilObject());
      return true;
    },

    primitiveSocketCreate3Semaphores(argCount) {
      if (argCount !== 7) return false;
      var socketType = this.interpreterProxy.stackIntegerValue(5);
      if (socketType !== this.TCP_Socket_Type) return false;
      var name = '{socket handle #' + (++this.handleCounter) + '}';
      var sqHandle = this.primHandler.makeStString(name);
      sqHandle.handle = this._newSocketHandle();
      this.interpreterProxy.popthenPush(argCount, sqHandle);
      return true;
    },

    primitiveSocketDestroy(argCount) {
      if (argCount !== 1) return false;
      var handle = this.interpreterProxy.stackObjectValue(0).handle;
      if (handle === undefined) return false;
      handle.destroy();
      this.interpreterProxy.popthenPush(1, handle.status);
      return true;
    },

    primitiveSocketReceiveDataAvailable(argCount) {
      if (argCount !== 1) return false;
      var handle = this.interpreterProxy.stackObjectValue(0).handle;
      if (handle === undefined) return false;
      var ret = this.primHandler.makeStObject(handle.can_read());
      this.interpreterProxy.popthenPush(1, ret);
      return true;
    },

    primitiveSocketReceiveDataBufCount(argCount) {
      if (argCount !== 4) return false;
      var handle = this.interpreterProxy.stackObjectValue(3).handle;
      if (handle === undefined) return false;

      var target = this.interpreterProxy.stackObjectValue(2);
      var start = this.interpreterProxy.stackIntegerValue(1) - 1;
      var count = this.interpreterProxy.stackIntegerValue(0);

      var bytes = handle.recv(count);
      target.bytes.set(bytes, start);
      this.interpreterProxy.popthenPush(argCount, bytes.length);
      return true;
    },

    primitiveSocketSendDataBufCount(argCount) {
      if (argCount !== 4) return false;
      var handle = this.interpreterProxy.stackObjectValue(3).handle;
      if (handle === undefined) return false;
      var data = this.interpreterProxy.stackObjectValue(2).bytesAsString();
      var start = this.interpreterProxy.stackIntegerValue(1) - 1;
      if (start < 0 ) return false;
      var count = this.interpreterProxy.stackIntegerValue(0);
      var end = start + count;
      if (end > data.length) return false;

      res = handle.send(data.slice(start, end));
      this.interpreterProxy.popthenPush(1, res);
      return true;
    },

    primitiveSocketSendDone(argCount) {
      if (argCount !== 1) return false;
      this.interpreterProxy.popthenPush(1, this.interpreterProxy.trueObject());
      return true;
    },
  };
}

window.addEventListener('load', function() {
  Squeak.registerExternalModule('SocketPlugin', SocketPlugin());
});
