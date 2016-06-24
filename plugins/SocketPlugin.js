/*
 * This Socket plugin only fulfills http:/https: requests by intercepting them
 * and sending as XMLHttpRequest. To make connections to servers without CORS,
 * it uses the crossorigin.me proxy.
 */

function SocketPlugin() {

  return {
    getModuleName() { return 'SocketPlugin (http-only)'; },
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
    _newSocketHandle(sendBufSize, connSemaIndex, readSemaIndex, writeSemaIndex) {
      var that = this;
      return {
        host: null,
        port: null,

        connSemaIndex: connSemaIndex,
        readSemaIndex: readSemaIndex,
        writeSemaIndex: writeSemaIndex,

        sendBuffer: new Uint8Array(sendBufSize),
        sendBufferIndex: 0,
        sendTimeout: null,

        response: [],
        responseIndex: 0,
        responseLength: null,
        responseReceived: false,

        status: that.Socket_Unconnected,

        _signalSemaphore(semaIndex) {
          if (semaIndex <= 0) return;
          that.primHandler.signalSemaphoreWithIndex(semaIndex);
        },
        _signalConnSemaphore() { this._signalSemaphore(this.connSemaIndex); },
        _signalReadSemaphore() { this._signalSemaphore(this.readSemaIndex); },
        _signalWriteSemaphore() { this._signalSemaphore(this.writeSemaIndex); },

        _performRequest() {
          var request = new TextDecoder("utf-8").decode(this.sendBuffer);
          var requestLines = request.split('\n');
          // Split header lines and parse first line
          var firstLineItems = request.split('\n')[0].split(' ');
          var httpMethod = firstLineItems[0];
          if (httpMethod !== 'GET' && httpMethod !== 'PUT' &&
              httpMethod !== 'POST') {
            this.status = that.Socket_OtherEndClosed;
            this._signalConnSemaphore();
            return -1;
          }
          var targetURL = firstLineItems[1];

          var url;
          if (this.port !== 443) {
            url = 'http://' + this.host + ':' + this.port + targetURL;
          } else {
            url = 'https://' + this.host + targetURL;
          }

          var contentType, contentLength;
          for (var i = 1; i < requestLines.length; i++) {
            var line = requestLines[i];
            if (line.indexOf('Content-Type: ') === 0) {
              contentType = encodeURIComponent(line.substr(14));
            } else if (line.indexOf('Content-Length: ') === 0) {
              contentLength = parseInt(line.substr(16));
            }
          }

          // Extract possible data to send
          var data = null;
          if (contentLength !== undefined) {
            data = this.sendBuffer.slice(this.sendBufferIndex - contentLength, this.sendBufferIndex);
          }

          var httpRequest = new XMLHttpRequest();
          httpRequest.open(httpMethod, url);
          if (contentType !== undefined) {
            httpRequest.setRequestHeader('Content-type', contentType);
          }
          httpRequest.responseType = "arraybuffer";

          var thisHandle = this;
          httpRequest.onload = function (oEvent) {
            var content = this.response;
            if (content) {
              // Fake header
              var header = new TextEncoder('utf-8').encode(
                'HTTP/1.0 ' + this.status + ' OK\r\n' +
                'Server: SqueakJS SocketPlugin Proxy\r\n' +
                'Content-Length: ' + content.byteLength + '\r\n\r\n');

              // Concat fake header and content
              thisHandle.response = new Uint8Array(header.byteLength + content.byteLength);
              thisHandle.response.set(header, 0);
              thisHandle.response.set(new Uint8Array(content), header.byteLength);
              thisHandle.responseLength = thisHandle.response.byteLength;

              that.primHandler.signalSemaphoreWithIndex(thisHandle.readSemaIndex);
            } else {
              thisHandle.status = that.Socket_OtherEndClosed;
            }
          };

          httpRequest.onerror = function(e) {
            console.warn('Retrying with CORS proxy: ' + url);
            var proxy = 'https://cors-anywhere.herokuapp.com/'; //'https://crossorigin.me/',
                retry = new XMLHttpRequest();
            var proxyURL = proxy + (this.port === 443 ? url : 'http://' + thisHandle.host + targetURL);
            retry.open(httpMethod, proxyURL);
            retry.responseType = httpRequest.responseType;
            retry.onload = httpRequest.onload;
            retry.onerror = function() {
              thisHandle.status = that.Socket_OtherEndClosed;
              alert("Failed to download:\n" + url);
            };
            retry.send(data);
          };

          httpRequest.send(data);
        },

        connect(host, port) {
          this.host = host;
          this.port = port;
          this.status = that.Socket_Connected;
          this._signalConnSemaphore();
          this._signalWriteSemaphore(); // Immediately ready to write
        },

        close() {
          if (this.status == that.Socket_Connected ||
              this.status == that.Socket_OtherEndClosed ||
              this.status == that.Socket_WaitingForConnection) {
            this.status = that.Socket_Unconnected;
            this._signalConnSemaphore();
          }
        },

        destroy() {
          this.status = that.Socket_InvalidSocket;
        },

        dataAvailable() {
          if (this.status == that.Socket_InvalidSocket) return false;
          if (this.status == that.Socket_Connected) {
            if (!this.responseReceived) {
              this._signalReadSemaphore();
              return true;
            } else {
              this.status = that.Socket_OtherEndClosed;
              this._signalConnSemaphore();
            }
          }
          return false;
        },

        recv(start, count) {
          if (this.responseLength !== null && start >= this.responseLength) {
            this.responseReceived = true; // Everything has been read
          }
          this.responseIndex = start + count;
          return this.response.slice(start, start + count);
        },

        send(data, start, end) {
          if (this.sendTimeout !== null) {
            window.clearTimeout(this.sendTimeout);
          }
          this.lastSend = Date.now();
          newBytes = data.bytes.slice(start, end);
          this.sendBuffer.set(newBytes, this.sendBufferIndex);
          this.sendBufferIndex += newBytes.byteLength;
          // Give image some time to send more data before performing requests
          this.sendTimeout = setTimeout(this._performRequest.bind(this), 50);
          return newBytes.byteLength;
        }
      };
    },

    primitiveHasSocketAccess(argCount) {
      this.interpreterProxy.popthenPush(1, this.interpreterProxy.trueObject());
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
      var writeSemaIndex = this.interpreterProxy.stackIntegerValue(0);
      var readSemaIndex = this.interpreterProxy.stackIntegerValue(1);
      var semaIndex = this.interpreterProxy.stackIntegerValue(2);
      var sendBufSize = this.interpreterProxy.stackIntegerValue(3);
      var socketType = this.interpreterProxy.stackIntegerValue(5);
      if (socketType !== this.TCP_Socket_Type) return false;
      var name = '{SqueakJS Socket #' + (++this.handleCounter) + '}';
      var sqHandle = this.primHandler.makeStString(name);
      sqHandle.handle = this._newSocketHandle(sendBufSize, semaIndex,
                                              readSemaIndex, writeSemaIndex);
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
      var ret = this.interpreterProxy.falseObject();
      if (handle.dataAvailable()) {
        ret = this.interpreterProxy.trueObject();
      }
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
      var bytes = handle.recv(start, count);
      target.bytes.set(bytes, start);
      this.interpreterProxy.popthenPush(argCount, bytes.length);
      return true;
    },

    primitiveSocketSendDataBufCount(argCount) {
      if (argCount !== 4) return false;
      var handle = this.interpreterProxy.stackObjectValue(3).handle;
      if (handle === undefined) return false;
      var data = this.interpreterProxy.stackObjectValue(2);
      var start = this.interpreterProxy.stackIntegerValue(1) - 1;
      if (start < 0 ) return false;
      var count = this.interpreterProxy.stackIntegerValue(0);
      var end = start + count;
      if (end > data.length) return false;

      res = handle.send(data, start, end);
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
