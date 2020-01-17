// This a Wrapper for the node ws WebSocket implementation to resemble the
// browser WebSocket implementation better. 
var WebSocket = require("./ws/websocket");

class SafeWebSocketClient extends WebSocket {
	constructor(url, protocols) {
		super(url, protocols, { perMessageDeflate: false });
	}
}

module.exports = SafeWebSocketClient;
