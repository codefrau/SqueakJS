// This is a minimal headless SqueakJS VM
//
// The headless SqueakJS VM can be used inside a browser.
// The VM can run in the main (UI) thread or in a WebWorker thread. Some browsers
// do not support ES6 modules yet for WebWorker scripts. Please use or create
// a Javascript bundle of the VM in that case.
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
//
// There is no default file support loaded. If needed add the relevant modules/plugins like:
// import "./vm.files.browser.js";
// import "./vm.plugins.file.browser.js";

// Load VM and the internal plugins
import "./globals.js";
import "./vm.js";
import "./vm.object.js";
import "./vm.object.spur.js";
import "./vm.image.js";
import "./vm.interpreter.js";
import "./vm.interpreter.proxy.js";
import "./vm.instruction.stream.js";
import "./vm.instruction.stream.sista.js";
import "./vm.instruction.printer.js";
import "./vm.primitives.js";
import "./jit.js";
import "./vm.display.js";
import "./vm.display.headless.js";      // use headless display to prevent image crashing/becoming unresponsive
import "./vm.input.js";
import "./vm.input.headless.js";        // use headless input to prevent image crashing/becoming unresponsive
import "./vm.plugins.js";
import "./plugins/ConsolePlugin.js";

// Run image by starting interpreter on it
function runImage(imageData, imageName, options) {

    // Create Squeak image from raw data
    var image = new Squeak.Image(imageName.replace(/\.image$/i, ""));
    image.readFromBuffer(imageData, function startRunning() {

        // Create fake display and create interpreter
        var display = { vmOptions: [ "-vm-display-null", "-nodisplay" ] };
        var vm = new Squeak.Interpreter(image, display);
        function run() {
            try {
                vm.interpret(50, function runAgain(ms) {
                    // Ignore display.quitFlag when requested.
                    // Some Smalltalk images quit when no display is found.
                    if(options.ignoreQuit || !display.quitFlag) {
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
}

function fetchImageAndRun(imageName, options) {
    fetch(imageName, {
        method: "GET",
        mode: "cors",
        cache: "no-store"
    }).then(function(response) {
        if(!response.ok) {
            throw new Error("Response not OK: " + response.status);
        }
        return response.arrayBuffer();
    }).then(function(imageData) {
        runImage(imageData, imageName, options);
    }).catch(function(error) {
        console.error("Failed to retrieve image", error);
    });
}

// Extend Squeak with settings and options to fetch and run image
Object.extend(Squeak, {
    vmPath: "/",
    platformSubtype: "Browser",
    osVersion: navigator.userAgent,     // might want to parse
    windowSystem: "headless",
    fetchImageAndRun: fetchImageAndRun,
});


// Retrieve image name from URL
var searchParams = (new URL(self.location)).searchParams;
var imageName = searchParams.get("imageName");
if(imageName) {
    var options = {
        ignoreQuit: searchParams.get("ignoreQuit") !== null
    };
    fetchImageAndRun(imageName, options);
}
