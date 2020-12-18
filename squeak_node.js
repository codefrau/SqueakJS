// This is a SqueakJS VM for use with node
//
// To start an image use: node squeak_node.js [-ignoreQuit] <image filename>
//
// To start the minimal headless image present in the folder "headless" use:
//    node squeak_node.js headless/headless.image
//
// Option "-ignoreQuit" is present to prevent some images from quiting when
// no GUI (support) is found. The image will not be able to quit from within
// the image and needs to be quit by stopping the process itself.
// In some situations adding "-ignoreQuit" can make some minimal images crash
// when no more processes are running (ie when no bytecode is left to execute).
//
// A special ConsolePlugin is loaded which allows sending messages to the console.
// Add the following method to the Smalltalk image (to Object for example):
//
// primLog: messageString level: levelString
//
//	"Log messageString to the console. The specified level should be one of:
//		'log'
//		'info'
//		'warn'
//		'error'
//	"
//
// 	<primitive: 'primitiveLog:level:' module: 'ConsolePlugin'>
//	^ self
//
// The VM will try to load plugins when named primitives are used for the first time.
// These plugins do not need to be imported up front.

var os = require("os");
var fs = require("fs");
var process = require("process");
var path = require("path");

// Retrieve image name and parameters from command line
var processArgs = process.argv.slice(2);
var ignoreQuit = processArgs[0] === "-ignoreQuit";
if(ignoreQuit) {
    processArgs = processArgs.slice(1);
}
var fullName = processArgs[0];
if(!fullName) {
    console.error("No image name specified.");
    console.log("Usage (simplified): " + path.basename(process.argv0) + path.basename(process.argv[1]) + " [-ignoreQuit] <image filename>");
    process.exit(1);
}
var root = path.dirname(fullName) + path.sep;
var imageName = path.basename(fullName, ".image");

// Create global 'self' resembling the global scope in the browser DOM
Object.assign(global, {

    // Add browser element 'self' for platform consistency
    self: new Proxy({}, {
        get: function(obj, prop) {
            return global[prop];
        },
        set: function(obj, prop, value) {
            global[prop] = value;
            return true;
        }
    })
});

// Extend the new global scope with a few browser/DOM classes and methods
Object.assign(self, {
    localStorage: {},
    WebSocket: require("./lib_node/WebSocket"),
    sha1: require("./lib/sha1"),
    btoa: function(string) {
        return Buffer.from(string, 'ascii').toString('base64');
    },
    atob: function(string) {
        return Buffer.from(string, 'base64').toString('ascii');
    }
});

// Load VM and the internal plugins
require("./globals.js");
require("./vm.js");
require("./vm.object.js");
require("./vm.object.spur.js");
require("./vm.image.js");
require("./vm.interpreter.js");
require("./vm.interpreter.proxy.js");
require("./vm.instruction.stream.js");
require("./vm.instruction.stream.sista.js");
require("./vm.instruction.printer.js");
require("./vm.primitives.js");
require("./jit.js");
require("./vm.display.js");
require("./vm.display.headless.js");    // use headless display to prevent image crashing/becoming unresponsive
require("./vm.input.js");
require("./vm.input.headless.js");    // use headless input to prevent image crashing/becoming unresponsive
require("./vm.plugins.js");
require("./vm.plugins.file.node");

// Set the appropriate VM and platform values
Object.extend(Squeak, {
    vmPath: process.cwd() + path.sep,
    platformSubtype: "Node.js",
    osVersion: process.version + " " + os.platform() + " " + os.release() + " " + os.arch(),
    windowSystem: "none",
});

// Extend the Squeak primitives with ability to load modules dynamically
Object.extend(Squeak.Primitives.prototype, {
    loadModuleDynamically: function(modName) {
        try {
            require("./plugins/" + modName);

            // Modules register themselves, should be available now
            return Squeak.externalModules[modName];
        } catch(e) {
            console.error("Plugin " + modName + " could not be loaded");
        }
        return undefined;
    }
});

// Read raw image
fs.readFile(root + imageName + ".image", function(error, data) {
    if(error) {
        console.error("Failed to read image", error);
        return;
    }

    // Create Squeak image from raw data
    var image = new Squeak.Image(root + imageName);
    image.readFromBuffer(data.buffer, function startRunning() {

        // Create fake display and create interpreter
        var display = { vmOptions: [ "-vm-display-null", "-nodisplay" ] };
        var vm = new Squeak.Interpreter(image, display);
        function run() {
            try {
                vm.interpret(200, function runAgain(ms) {

                    // Ignore display.quitFlag when requested.
                    // Some Smalltalk images quit when no display is found.
                    if(ignoreQuit || !display.quitFlag) {
                        setTimeout(run, ms === "sleep" ? 10 : ms);
                    }
                });
            } catch(e) {
                console.error("Failure during Squeak run: ", e);
            }
        }

        // Start the interpreter
        run();
    });
});
