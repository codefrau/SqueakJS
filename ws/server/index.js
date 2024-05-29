var http = require("http");
var ws = require("ws");
var readline = require('readline');

function startServer(port) {

	// Create HTTP server
	var httpServer = new http.createServer();

	// Create WebSocket server
	var webSocketServer = new ws.Server({ noServer: true });
	webSocketServer
		.on("connection", function(ws) {
			console.log("Connection made.");

			// Allow interaction on connection
			var io = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			var handleIO = function() {
				io.question("Next command: ", function(command) {
					if (command) {
						isClosed = isClosed || [ "quit", "exit", "bye" ].indexOf(command) >= 0;
						if (!isClosed) {
							ws.send(command);
						} else {
							ws.close();
							io.close();
						}
					} else {
						handleIO();
					}
				});
			};

			// Handle events
			var isClosed = false;
			ws
				.on("message", function(message) {
					console.log("Message received: " + message);
					handleIO();	// Do next command
				})
				.on("close", function(code) {
					console.log("Connection closed: " + code);
					isClosed = true;
					io.close();
				})
			;

			// Send first command (will trigger IO handling)
			ws.send("3 + 4");
		})
	;

	// Start HTTP server
	httpServer.on("upgrade", function(request, socket, head) {
		console.log("Upgrading");
		webSocketServer.handleUpgrade(request, socket, head, function(ws) {
			webSocketServer.emit("connection", ws, request);
		});
	});

	httpServer.listen(9000);
};

console.log("Starting WebSocketServer on port 9000");
console.log("Waiting on clients to connect...");
startServer();
