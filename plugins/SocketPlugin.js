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
    needProxy: new Set(),

    // DNS Lookup
    lastLookup: null,

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
    _newSocketHandle(sendBufSize, connSemaIdx, readSemaIdx, writeSemaIdx) {
      var plugin = this;
      return {
        host: null,
        port: null,

        connSemaIndex: connSemaIdx,
        readSemaIndex: readSemaIdx,
        writeSemaIndex: writeSemaIdx,

        sendBuffer: null,
        sendTimeout: null,

        response: null,
        responseReadUntil: 0,
        responseReceived: false,

        status: plugin.Socket_Unconnected,

        _signalSemaphore(semaIndex) {
          if (semaIndex <= 0) return;
          plugin.primHandler.signalSemaphoreWithIndex(semaIndex);
        },
        _signalConnSemaphore() { this._signalSemaphore(this.connSemaIndex); },
        _signalReadSemaphore() { this._signalSemaphore(this.readSemaIndex); },
        _signalWriteSemaphore() { this._signalSemaphore(this.writeSemaIndex); },

        _otherEndClosed() {
          this.status = plugin.Socket_OtherEndClosed;
          this._signalConnSemaphore();
        },

        _hostAndPort() { return this.host + ':' + this.port; },

        _requestNeedsProxy() {
          return plugin.needProxy.has(this._hostAndPort());
        },

        _getURL(targetURL, isRetry) {
          var url = '';
          if (isRetry || this._requestNeedsProxy()) {
            url += SqueakJS.options.proxy || 'https://crossorigin.me/';
          }
          if (this.port !== 443) {
            url += 'http://' + this._hostAndPort() + targetURL;
          } else {
            url += 'https://' + this.host + targetURL;
          }
          return url;
        },

        _performRequest() {
          var request = new TextDecoder("utf-8").decode(this.sendBuffer);
          var headerLines = request.split('\r\n\r\n')[0].split('\n');
          // Split header lines and parse first line
          var firstHeaderLineItems = headerLines[0].split(' ');
          var httpMethod = firstHeaderLineItems[0];
          if (httpMethod !== 'GET' && httpMethod !== 'PUT' &&
              httpMethod !== 'POST') {
            this._otherEndClosed();
            return -1;
          }
          var targetURL = firstHeaderLineItems[1];

          // Extract possible data to send
          var data = null;
          for (var i = 1; i < headerLines.length; i++) {
            var line = headerLines[i];
            if (line.match(/Content-Length:/i)) {
              var contentLength = parseInt(line.substr(16));
              var end = this.sendBuffer.byteLength;
              data = this.sendBuffer.subarray(end - contentLength, end);
              break;
            }
          }

          if (window.fetch) {
            this._performFetchAPIRequest(targetURL, httpMethod, data, headerLines);
          } else {
            this._performXMLHTTPRequest(targetURL, httpMethod, data, headerLines);
          }
        },

        _performFetchAPIRequest(targetURL, httpMethod, data, requestLines) {
          var thisHandle = this;
          var headers = {};
          for (var i = 1; i < requestLines.length; i++) {
            var lineItems = requestLines[i].split(':');
            if (lineItems.length === 2) {
              headers[lineItems[0]] = lineItems[1].trim();
            }
          }
          var init = {
            method: httpMethod,
            headers: headers,
            body: data,
            mode: 'cors'
          };

          fetch(this._getURL(targetURL), init)
          .then(thisHandle._handleFetchAPIResponse.bind(thisHandle))
          .catch(function (e) { 
            var url = thisHandle._getURL(targetURL, true);
            console.warn('Retrying with CORS proxy: ' + url);
            fetch(url, init)
            .then(function(res) {
              console.log('Success: ' + url);
              thisHandle._handleFetchAPIResponse(res);
              plugin.needProxy.add(thisHandle._hostAndPort());
            })
            .catch(function (e) {
              // KLUDGE! This is just a workaround for a broken
              // proxy server - we should remove it when
              // crossorigin.me is fixed
              console.warn('Fetch API failed, retrying with XMLHttpRequest');
              thisHandle._performXMLHTTPRequest(targetURL, httpMethod, data, requestLines);
            });
          });
        },

        _handleFetchAPIResponse(res) {
          if (this.response === null) {
            var header = ['HTTP/1.0 ', res.status, ' ', res.statusText, '\r\n'];
            res.headers.forEach(function(value, key, array) {
              header = header.concat([key, ': ', value, '\r\n']);
            });
            header.push('\r\n');
            this.response = [new TextEncoder('utf-8').encode(header.join(''))];
          }
          this._readIncremental(res.body.getReader());
        },

        _readIncremental(reader) {
          var thisHandle = this;
          return reader.read().then(function (result) {
            if (result.done) {
              thisHandle.responseReceived = true;
              return;
            }
            thisHandle.response.push(result.value);
            thisHandle._signalReadSemaphore();
            return thisHandle._readIncremental(reader);
          });
        },

        _performXMLHTTPRequest(targetURL, httpMethod, data, requestLines){
          var thisHandle = this;

          var contentType;
          for (var i = 1; i < requestLines.length; i++) {
            var line = requestLines[i];
            if (line.match(/Content-Type:/i)) {
              contentType = encodeURIComponent(line.substr(14));
              break;
            }
          }

          var httpRequest = new XMLHttpRequest();
          httpRequest.open(httpMethod, this._getURL(targetURL));
          if (contentType !== undefined) {
            httpRequest.setRequestHeader('Content-type', contentType);
          }
          httpRequest.responseType = "arraybuffer";

          httpRequest.onload = function (oEvent) {
            thisHandle._handleXMLHTTPResponse(this);
          };

          httpRequest.onerror = function(e) {
            var url = thisHandle._getURL(targetURL, true);
            console.warn('Retrying with CORS proxy: ' + url);
            var retry = new XMLHttpRequest();
            retry.open(httpMethod, url);
            retry.responseType = httpRequest.responseType;
            retry.onload = function(oEvent) {
              console.log('Success: ' + url);
              thisHandle._handleXMLHTTPResponse(this);
              plugin.needProxy.add(thisHandle._hostAndPort());
            };
            retry.onerror = function() {
              thisHandle._otherEndClosed();
              console.error("Failed to download:\n" + url);
            };
            retry.send(data);
          };

          httpRequest.send(data);
        },

        _handleXMLHTTPResponse(response) {
          this.responseReceived = true;

          var content = response.response;
          if (!content) {
            this._otherEndClosed();
            return;
          }
          // Recreate header
          var header = new TextEncoder('utf-8').encode(
            'HTTP/1.0 ' + response.status + ' ' + response.statusText +
            '\r\n' + response.getAllResponseHeaders() + '\r\n');
          // Concat header and response
          var res = new Uint8Array(header.byteLength + content.byteLength);
          res.set(header, 0);
          res.set(new Uint8Array(content), header.byteLength);

          this.response = [res];
          this._signalReadSemaphore();
        },

        connect(host, port) {
          this.host = host;
          this.port = port;
          this.status = plugin.Socket_Connected;
          this._signalConnSemaphore();
          this._signalWriteSemaphore(); // Immediately ready to write
        },

        close() {
          if (this.status == plugin.Socket_Connected ||
              this.status == plugin.Socket_OtherEndClosed ||
              this.status == plugin.Socket_WaitingForConnection) {
            this.status = plugin.Socket_Unconnected;
            this._signalConnSemaphore();
          }
        },

        destroy() {
          this.status = plugin.Socket_InvalidSocket;
        },

        dataAvailable() {
          if (this.status == plugin.Socket_InvalidSocket) return false;
          if (this.status == plugin.Socket_Connected) {
            if (this.response && this.response.length > 0) {
              this._signalReadSemaphore();
              return true; 
            }
            if (this.responseSentCompletly) {
              // Signal older Socket implementations that they reached the end
              this.status = plugin.Socket_OtherEndClosed;
              this._signalConnSemaphore();
            }
          }
          return false;
        },

        recv(count) {
          if (this.response === null) return [];
          var data = this.response[0];
          if (data.length > count) {
            var rest = data.subarray(count);
            if (rest) {
              this.response[0] = rest;
            } else {
              this.response.shift();
            }
            data = data.subarray(0, count);
          } else {
            this.response.shift();
          }
          if (this.responseReceived && this.response.length === 0) {
            this.responseSentCompletly = true;
          }

          return data;
        },

        send(data, start, end) {
          if (this.sendTimeout !== null) {
            window.clearTimeout(this.sendTimeout);
          }
          this.lastSend = Date.now();
          newBytes = data.bytes.subarray(start, end);
          if (this.sendBuffer === null) {
            this.sendBuffer = newBytes;
          } else {
            var newLength = this.sendBuffer.byteLength + newBytes.byteLength;
            var newBuffer = new Uint8Array(newLength);
            newBuffer.set(this.sendBuffer, 0);
            newBuffer.set(newBytes, this.sendBuffer.byteLength);
            this.sendBuffer = newBuffer;
          }
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
      if (this.lastLookup !== null) {
        inet = this.primHandler.makeStString(this.lastLookup);
        this.lastLookup = null;
      } else {
        inet = this.interpreterProxy.nilObject();
      }
      this.interpreterProxy.popthenPush(1, inet);
      return true;
    },

    primitiveResolverStartNameLookup(argCount) {
      if (argCount !== 1) return false;
      this.lastLookup = this.interpreterProxy.stackValue(0).bytesAsString();
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
      if ((start + count) > target.bytes.length) return false;
      var bytes = handle.recv(count);
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
