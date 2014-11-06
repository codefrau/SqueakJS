/*
 * Copyright (c) 2013,2014 Bert Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


//////////////////////////////////////////////////////////////////////////////
// these functions fake the Lively module and class system
// just enough so the loading of vm.js succeeds
//////////////////////////////////////////////////////////////////////////////

module = function(dottedPath) {
    if (dottedPath == "") return window;
    var path = dottedPath.split("."),
        name = path.pop(),
        parent = module(path.join(".")),
        self = parent[name];
    if (!self) parent[name] = self = {
        loaded: false,
        pending: [],
        requires: function(req) {
            return {
                toRun: function(code) {
                    if (req && !module(req).loaded) {
                        module(req).pending.push(code);
                    } else {
                        code();
                        self.loaded = true;
                        self.pending.forEach(function(f){f()});
                    }
                }
            }
        },
    };
    return self;
};

Object.subclass = function(classPath /* + more args */ ) {
    var path = classPath.split("."),
        className = path.pop();
    var newClass = function() {
        if (this.initialize) this.initialize.apply(this, arguments);
        return this;
    };
    // skip arg 0, copy properties of other args to class proto
    for (var i = 1; i < arguments.length; i++)
        for (name in arguments[i])
            newClass.prototype[name] = arguments[i][name];
    module(path.join('.'))[className] = newClass;
};

Object.extend = function(obj /* + more args */ ) {
    // skip arg 0, copy properties of other args to obj
    for (var i = 1; i < arguments.length; i++)
        for (name in arguments[i])
            obj[name] = arguments[i][name];
};

//////////////////////////////////////////////////////////////////////////////
// load vm, plugins, and other libraries
//////////////////////////////////////////////////////////////////////////////

(function(){
    var scripts = document.getElementsByTagName("script"),
        squeakjs = scripts[scripts.length - 1],
        vmDir = squeakjs.src.replace(/[^\/]*$/, "");
    [   /* vm.js (squeak-all.js) */
        /* jit.js (squeak-all.js) */
        /* plugins/ADPCMCodecPlugin.js (squeak-all.js) */
        /* plugins/BitBltPlugin.js (squeak-all.js) */
        /* plugins/DSAPrims.js (squeak-all.js) */
        /* plugins/FFTPlugin.js (squeak-all.js) */
        /* plugins/FloatArrayPlugin.js (squeak-all.js) */
        /* plugins/JPEGReaderPlugin.js (squeak-all.js) */
        /* plugins/KedamaPlugin.js (squeak-all.js) */
        /* plugins/KedamaPlugin2.js (squeak-all.js) */
        /* plugins/Klatt.js (squeak-all.js) */
        /* plugins/LargeIntegers.js (squeak-all.js) */
        /* plugins/Matrix2x3Plugin.js (squeak-all.js) */
        /* plugins/MiscPrimitivePlugin.js (squeak-all.js) */
        /* plugins/ScratchPlugin.js (squeak-all.js) */
        /* plugins/SoundGenerationPlugin.js (squeak-all.js) */
        /* plugins/StarSqueakPlugin.js (squeak-all.js) */
        /* plugins/ZipPlugin.js (squeak-all.js) */
        /* lib/lz-string.js (squeak-all.js) */
    ].forEach(function(filename) {
        var script = document.createElement('script');
        script.setAttribute("type","text/javascript");
        script.setAttribute("src", vmDir + filename);
        document.getElementsByTagName("head")[0].appendChild(script);
    });
})();

module("SqueakJS").requires("users.bert.SqueakJS.vm").toRun(function() {


//////////////////////////////////////////////////////////////////////////////
// display & event setup 
//////////////////////////////////////////////////////////////////////////////

function setupFullscreen(display, canvas, options) {
    // Fullscreen can only be enabled in an event handler. So we check the
    // fullscreen flag on every mouse down/up and keyboard event.        

    // If the user canceled fullscreen, turn off the fullscreen flag so
    // we don't try to enable it again in the next event
    function fullscreenChange(fullscreen) {
        display.fullscreen = fullscreen;
        if (options.fullscreenCheckbox)
            options.fullscreenCheckbox.checked = display.fullscreen;
        setTimeout(window.onresize, 0);
    };

    var checkFullscreen;

    // Fullscreen support is very browser-dependent
    if (canvas.requestFullscreen) {
        document.addEventListener("fullscreenchange", function(){fullscreenChange(canvas == document.fullscreenElement)});
        checkFullscreen = function() {
            if (document.fullscreenEnabled && (canvas == document.fullscreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.requestFullscreen();
                else document.exitFullscreen();
            }
        }
    } else if (canvas.webkitRequestFullscreen) {
        document.addEventListener("webkitfullscreenchange", function(){fullscreenChange(canvas == document.webkitFullscreenElement)});
        checkFullscreen = function() {
            if (document.webkitFullscreenEnabled && (canvas == document.webkitFullscreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.webkitRequestFullscreen();
                else document.webkitExitFullscreen();
            }
        }
    } else if (canvas.mozRequestFullScreen) {
        document.addEventListener("mozfullscreenchange", function(){fullscreenChange(canvas == document.mozFullScreenElement)});
        checkFullscreen = function() {
            if (document.mozFullScreenEnabled && (canvas == document.mozFullScreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.mozRequestFullScreen();
                else document.mozCancelFullScreen();
            }
        }
    } else if (canvas.msRequestFullscreen) {
        document.addEventListener("MSFullscreenChange", function(){fullscreenChange(canvas == document.msFullscreenElement)});
        checkFullscreen = function() {
            if (document.msFullscreenEnabled && (canvas == document.msFullscreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.msRequestFullscreen();
                else document.msExitFullscreen();
            }
        }
    } else {
        var isFullscreen = false;
        checkFullscreen = function() {
            if ((options.header || options.footer) && isFullscreen != display.fullscreen) {
                isFullscreen = display.fullscreen;
                if (options.header) options.header.style.display = isFullscreen ? 'none' : '';
                if (options.footer) options.footer.style.display = isFullscreen ? 'none' : '';
                if (options.fullscreenCheckbox) options.fullscreenCheckbox.checked = isFullscreen;
                window.onresize();
            }
        }
    }
    
    if (options.fullscreenCheckbox) options.fullscreenCheckbox.onclick = function() {
        display.fullscreen = options.fullscreenCheckbox.checked;
        checkFullscreen();
    }

    return checkFullscreen;
}

function setupSwapButtons(options) {
    if (options.swapCheckbox) {
        var imageName = localStorage["squeakImageName"] || "default",
            settings = JSON.parse(localStorage["squeakSettings:" + imageName] || "{}");
        if ("swapButtons" in settings) options.swapButtons = settings.swapButtons;
        options.swapCheckbox.checked = options.swapButtons;
        options.swapCheckbox.onclick = function() {
            options.swapButtons = options.swapCheckbox.checked;
            settings["swapButtons"] = options.swapButtons;
            localStorage["squeakSettings:" + imageName] = JSON.stringify(settings);
        }
    }
}

function setupDragAndDrop(display, options) {
    // do not use addEventListener, we want to replace any previous drop handler
    document.body.ondragover = function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
        return false;
    };
    document.body.ondrop = function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        [].slice.call(evt.dataTransfer.files).forEach(function(f) {
            var reader = new FileReader();
            reader.onload = function () {
                var buffer = this.result;
                Squeak.filePut(f.name, buffer);
                if (/.*image$/.test(f.name) && confirm("Run " + f.name + " now?\n(cancel to use as file)")) {
                    SqueakJS.appName = f.name.slice(0, -6);
                    SqueakJS.runImage(buffer, f.name, display, options);
                } else {
                }
            };
            reader.readAsArrayBuffer(f);
        });
        return false;
    };
}

function recordModifiers(evt, display) {
    var modifiers =
        (evt.shiftKey ? Squeak.Keyboard_Shift : 0) +
        (evt.ctrlKey ? Squeak.Keyboard_Ctrl : 0) +
        (evt.altKey || evt.metaKey ? Squeak.Keyboard_Cmd : 0);
    display.buttons = (display.buttons & ~Squeak.Keyboard_All) | modifiers;
    return modifiers;
}

function recordMouseEvent(what, evt, canvas, display, eventQueue, options) {
    if (what != "touchend") {
        var x = ((evt.pageX - canvas.offsetLeft) * (canvas.width / canvas.offsetWidth)) | 0,
            y = ((evt.pageY - canvas.offsetTop) * (canvas.height / canvas.offsetHeight)) | 0;
            // subtract display offset and clamp to display size
        display.mouseX = Math.max(0, Math.min(display.width, x - display.offsetX));
        display.mouseY = Math.max(0, Math.min(display.height, y - display.offsetY));
    }
    var buttons = display.buttons & Squeak.Mouse_All;
    switch (what) {
        case 'mousedown':
        case 'touchstart':
            switch (evt.button || 0) {
                case 0: buttons = Squeak.Mouse_Red; break;      // left
                case 1: buttons = Squeak.Mouse_Yellow; break;   // middle
                case 2: buttons = Squeak.Mouse_Blue; break;     // right
            }; 
            if (options.swapButtons)
                if (buttons == Squeak.Mouse_Yellow) buttons = Squeak.Mouse_Blue;
                else if (buttons == Squeak.Mouse_Blue) buttons = Squeak.Mouse_Yellow;
            break;
        case 'mousemove':
        case 'touchmove':
            break; // nothing more to do
        case 'mouseup':
        case 'touchend':
            buttons = 0;
            break;
    }
    display.buttons = buttons | recordModifiers(evt, display);
    if (eventQueue) {
        eventQueue.push([
            Squeak.EventTypeMouse,
            evt.timeStamp,  // converted to Squeak time in makeSqueakEvent()
            display.mouseX,
            display.mouseY,
            display.buttons & Squeak.Mouse_All,
            display.buttons >> 3,
        ]);
        if (display.signalInputEvent)
            display.signalInputEvent();
    }
    display.idle = 0;
    if (what == 'mouseup') {
        if (display.runFor) display.runFor(100); // maybe we catch the fullscreen flag change
    } else {
        if (display.runNow) display.runNow();   // don't wait for timeout to run
    }
}

function recordKeyboardEvent(key, timestamp, display, eventQueue) {
    var code = (display.buttons >> 3) << 8 | key;
    if (code === display.vm.interruptKeycode) {
        display.vm.interruptPending = true;
    } else if (eventQueue) {
        eventQueue.push([
            Squeak.EventTypeKeyboard,
            timestamp,  // converted to Squeak time in makeSqueakEvent()
            key, // MacRoman
            Squeak.EventKeyChar,
            display.buttons >> 3, 
            0,  // Unicode 
        ]);
        if (display.signalInputEvent)
            display.signalInputEvent();
    } else {
        // no event queue, queue keys the old-fashioned way
        display.keys.push(code);
    }
    display.idle = 0;
    if (display.runNow) display.runNow(); // don't wait for timeout to run
}

function fakeCmdOrCtrlKey(key, timestamp, display, eventQueue) {
    // set both Cmd and Ctrl bit, because we don't know what the image wants
    display.buttons &= ~Squeak.Keyboard_All;  // remove all modifiers
    display.buttons |= Squeak.Keyboard_Cmd | Squeak.Keyboard_Ctrl;
    display.keys = []; //  flush other keys
    recordKeyboardEvent(key, timestamp, display, eventQueue);
}

function makeSqueakEvent(evt, sqEvtBuf, sqTimeOffset) {
    sqEvtBuf[0] = evt[0];
    sqEvtBuf[1] = (evt[1] - sqTimeOffset) & Squeak.MillisecondClockMask;
    for (var i = 2; i < evt.length; i++)
        sqEvtBuf[i] = evt[i];
}

function createSqueakDisplay(canvas, options) {
    options = options || {};
    if (options.fullscreen) {
        document.body.style.margin = 0;
        document.body.style.backgroundColor = 'black';
        if (options.header) options.header.style.display = 'none';
        if (options.footer) options.footer.style.display = 'none';
    }
    var display = {
        context: canvas.getContext("2d"),
        fullscreen: false,
        offsetX: 0,
        offsetY: 0,
        width: 0,   // if 0, VM uses canvas.width
        height: 0,  // if 0, VM uses canvas.height
        mouseX: 0,
        mouseY: 0,
        buttons: 0,
        keys: [],
        clipboardString: '',
        clipboardStringChanged: false,
        signalInputEvent: null, // function set by VM
        // additional functions added below
    };
    setupDragAndDrop(display, options);
    setupSwapButtons(options);

    var eventQueue = null;
    display.reset = function() {
        eventQueue = null;
        display.signalInputEvent = null;
        display.lastTick = 0;
        display.getNextEvent = function(firstEvtBuf, firstOffset) {
            // might be called from VM to get queued event
            eventQueue = []; // create queue on first call
            display.getNextEvent = function getNextEvent(evtBuf, timeOffset) {
                var evt = eventQueue.shift();
                if (evt) makeSqueakEvent(evt, evtBuf, timeOffset);
                else evtBuf[0] = Squeak.EventTypeNone;
            };
            display.getNextEvent(firstEvtBuf, firstOffset);
        };
    }
    display.reset();

    var checkFullscreen = setupFullscreen(display, canvas, options);
    display.fullscreenRequest = function(fullscreen, thenDo) {
        // called from primitive to change fullscreen mode
        if (display.fullscreen != fullscreen) {
            display.fullscreen = fullscreen;
            display.resizeTodo = thenDo;    // called after resizing
            display.resizeTodoTimeout = setTimeout(display.resizeDone, 1000);
            checkFullscreen();
        } else thenDo();
    };
    display.resizeDone = function() {
        clearTimeout(display.resizeTodoTimeout);
        var todo = display.resizeTodo;
        if (todo) {
            display.resizeTodo = null;
            todo();
        }
    }
    display.clear = function() {
        canvas.width = canvas.width;
    };
    display.showBanner = function(msg, style) {
        style = style || {};
        var ctx = display.context;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = style.color || "#F90";
        ctx.font = style.font || 'bold 48px sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    };
    display.showProgress = function(value, style) {
        style = style || {};
        var ctx = display.context,
            w = (canvas.width / 3) | 0,
            h = 24,
            x = canvas.width * 0.5 - w / 2,
            y = canvas.height * 0.5 + 2 * h;
        ctx.fillStyle = style.background || "#000";
        ctx.fillRect(x, y, w, h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = style.color || "#F90";
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = style.color || "#F90";
        ctx.fillRect(x, y, w * value, h);
    };
    canvas.onmousedown = function(evt) {
        checkFullscreen();
        recordMouseEvent('mousedown', evt, canvas, display, eventQueue, options);
        evt.preventDefault();
        return false;
    };
    canvas.onmouseup = function(evt) {
        recordMouseEvent('mouseup', evt, canvas, display, eventQueue, options);
        checkFullscreen();
        evt.preventDefault();
    };
    canvas.onmousemove = function(evt) {
        recordMouseEvent('mousemove', evt, canvas, display, eventQueue, options);
        evt.preventDefault();
    };
    canvas.oncontextmenu = function() {
        return false;
    };
    canvas.ontouchstart = function(evt) {
        evt.touches[0].timeStamp = evt.timeStamp;
        recordMouseEvent('touchstart', evt.touches[0], canvas, display, eventQueue, options);
        if (display.runNow) display.runNow(); // don't wait for timeout to run
        evt.preventDefault();
    };
    canvas.ontouchmove = function(evt) {
        evt.touches[0].timeStamp = evt.timeStamp;
        recordMouseEvent('touchmove', evt.touches[0], canvas, display, eventQueue, options);
        if (display.runNow) display.runNow(); // don't wait for timeout to run
        evt.preventDefault();
    };
    canvas.ontouchend = function(evt) {
        recordMouseEvent('touchend', evt, canvas, display, eventQueue, options);
        if (display.runNow) display.runNow(); // don't wait for timeout to run
        evt.preventDefault();
    };
    canvas.ontouchcancel = function(evt) {
        canvas.ontouchend(evt);
    };
    document.onkeypress = function(evt) {
        // check for ctrl-x/c/v/r
        if (/[CXVR]/.test(String.fromCharCode(evt.charCode + 64)))
            return true;  // let browser handle cut/copy/paste/reload
        recordModifiers(evt, display);
        recordKeyboardEvent(evt.charCode, evt.timeStamp, display, eventQueue);
        evt.preventDefault();
    };
    document.onkeydown = function(evt) {
        checkFullscreen();
        recordModifiers(evt, display);
        var squeakCode = ({
            8: 8,   // Backspace
            9: 9,   // Tab
            13: 13, // Return
            27: 27, // Escape
            33: 11, // PageUp
            34: 12, // PageDown
            35: 4,  // End
            36: 1,  // Home
            37: 28, // Left
            38: 30, // Up
            39: 29, // Right
            40: 31, // Down
            45: 5,  // Insert
            46: 127, // Delete
        })[evt.keyCode];
        if (squeakCode) { // special key pressed
            recordKeyboardEvent(squeakCode, evt.timeStamp, display, eventQueue);
            return evt.preventDefault();
        }
        if ((evt.metaKey || evt.altKey)) {
            var key = evt.key; // only supported in FireFox, others have keyIdentifier
            if (!key && evt.keyIdentifier && evt.keyIdentifier.slice(0,2) == 'U+')
                key = String.fromCharCode(parseInt(evt.keyIdentifier.slice(2), 16))
            if (key && key.length == 1) {
                if (/[CXVR]/i.test(key))
                    return true;  // let browser handle cut/copy/paste/reload
                var code = key.charCodeAt(0);
                if (/[A-Z]/.test(key) && !evt.shiftKey) code += 32;  // make lower-case
                recordKeyboardEvent(code, evt.timeStamp, display, eventQueue);
                return evt.preventDefault();
            }
        }
    };
    document.onkeyup = function(evt) {
        recordModifiers(evt, display);
    };
    document.oncopy = function(evt, key) {
        // simulate copy event for Squeak so it places its text in clipboard
        display.clipboardStringChanged = false;
        fakeCmdOrCtrlKey((key || 'c').charCodeAt(0), evt.timeStamp, display, eventQueue);
        var start = Date.now();
        // now interpret until Squeak has copied to the clipboard
        while (!display.clipboardStringChanged && Date.now() - start < 500)
            display.vm.interpret(20);
        if (!display.clipboardStringChanged) return;
        // got it, now copy to the system clipboard
        try {
            evt.clipboardData.setData("Text", display.clipboardString);
        } catch(err) {
            alert("copy error " + err);
        }
        evt.preventDefault();
    };
    document.oncut = function(evt) {
        document.oncopy(evt, 'x');
    };
    document.onpaste = function(evt) {
        try {
            display.clipboardString = evt.clipboardData.getData('Text');
            // simulate paste event for Squeak
            fakeCmdOrCtrlKey('v'.charCodeAt(0), evt.timeStamp, display, eventQueue);
        } catch(err) {
            alert("paste error " + err);
        }
        evt.preventDefault();
    };
    window.onresize = function() {
        // call resizeDone only if window size didn't change for 300ms
        var debounceWidth = window.innerWidth,
            debounceHeight = window.innerHeight;
        setTimeout(function() {
            if (debounceWidth == window.innerWidth && debounceHeight == window.innerHeight)
                display.resizeDone();
        }, 300);

        // if no fancy layout, don't bother
        if ((!options.header || !options.footer) && !options.fullscreen) {
            display.width = canvas.width;
            display.height = canvas.height;
            return;
        }
        // CSS won't let us do what we want so we will layout the canvas ourselves.
        // Also, we need to paper over browser differences in fullscreen mode where
        // Firefox scales the canvas but Webkit does not, which makes a difference
        // if we do not use actual pixels but are scaling a fixed-resolution canvas.
        var fullscreen = options.fullscreen || display.fullscreen,
            x = 0,
            y = fullscreen ? 0 : options.header.offsetTop + options.header.offsetHeight,
            w = window.innerWidth,
            h = fullscreen ? window.innerHeight : Math.max(100, options.footer.offsetTop - y),
            innerPadX = 0, // padding inside canvas
            innerPadY = 0,
            outerPadX = 0, // padding outside canvas
            outerPadY = 0;
        // above are the default values for laying out the canvas
        if (!options.fixedWidth) { // set canvas resolution
            display.width = w;
            display.height = h;
        } else { // fixed resolution and aspect ratio
            display.width = options.fixedWidth;
            display.height = options.fixedHeight;
            var wantRatio = display.width / display.height,
                haveRatio = w / h;
            if (fullscreen) { // need to use inner padding
                if (haveRatio > wantRatio) {
                    innerPadX = Math.floor(display.height * haveRatio) - display.width;
                } else {
                    innerPadY = Math.floor(display.width / haveRatio) - display.height;
                }
            } else { // can control outer padding
                if (haveRatio > wantRatio) {
                    outerPadX = w - Math.floor(h * wantRatio);
                } else {
                    outerPadY = h - Math.floor(w / wantRatio);
                }
            }
        }
        // set size and position
        canvas.style.left = (x + Math.floor(outerPadX / 2)) + "px";
        canvas.style.top = (y + Math.floor(outerPadY / 2)) + "px";
        canvas.style.width = (w - outerPadX) + "px";
        canvas.style.height = (h - outerPadY) + "px";
        // set resolution
        var canvasWidth = display.width + innerPadX,
            canvasHeight = display.height + innerPadY,
            oldOffsetX = display.offsetX,
            oldOffsetY = display.offsetY;
        display.offsetX = Math.floor(innerPadX / 2);
        display.offsetY = Math.floor(innerPadY / 2);
        if (canvas.width != canvasWidth || canvas.height != canvasHeight) {
            var preserveScreen = options.fixedWidth || !display.resizeTodo, // preserve unless changing fullscreen
                imgData = preserveScreen && display.context.getImageData(oldOffsetX, oldOffsetY, canvas.width, canvas.height);
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            if (imgData) display.context.putImageData(imgData, display.offsetX, display.offsetY);
        }
    };
    window.onresize();
    return display;
};

function setupSpinner(vm, options) {
    var spinner = options.spinner;
    if (!spinner) return null;
    spinner.onmousedown = function(evt) {
        if (confirm(SqueakJS.appName + " is busy. Interrupt?"))
            vm.interruptPending = true;
    }
    return spinner.style;
}

var spinnerAngle = 0,
    becameBusy = 0;
function updateSpinner(spinner, idleMS, vm, display) {
    var busy = idleMS === 0,
        animating = vm.lastTick - display.lastTick < 500; 
    if (!busy || animating) {
        spinner.display = "none";
        becameBusy = 0;
    } else {
        if (becameBusy === 0) {
            becameBusy = vm.lastTick;
        } else if (vm.lastTick - becameBusy > 1000) {
            spinner.display = "block";
            spinnerAngle = (spinnerAngle + 30) % 360;
            spinner.webkitTransform = spinner.transform = "rotate(" + spinnerAngle + "deg)";
        }
    }
}

//////////////////////////////////////////////////////////////////////////////
// main loop 
//////////////////////////////////////////////////////////////////////////////

var loop; // holds timeout for main loop

SqueakJS.runImage = function(buffer, name, display, options) {
    window.onbeforeunload = function() {
        return SqueakJS.appName + " is still running";
    };
    window.clearTimeout(loop);
    display.reset();
    display.clear();
    display.showBanner("Loading " + SqueakJS.appName);
    display.showProgress(0);
    var self = this;
    window.setTimeout(function() {
        var image = new Squeak.Image(name);
        image.readFromBuffer(buffer, function() {
            display.quitFlag = false;
            var vm = new Squeak.Interpreter(image, display);
            SqueakJS.vm = vm;
            localStorage["squeakImageName"] = name;
            setupSwapButtons(options);
            display.clear();
            display.showBanner("Starting " + SqueakJS.appName);
            var spinner = setupSpinner(vm, options);
            function run() {
                try {
                    if (display.quitFlag) self.onQuit(vm, display, options);
                    else vm.interpret(50, function(ms) {
                        if (ms == "sleep") ms = 200;
                        if (spinner) updateSpinner(spinner, ms, vm, display);
                        loop = window.setTimeout(run, ms);
                    });
                } catch(error) {
                    console.error(error);
                    alert(error);
                }
            };
            display.runNow = function() {
                window.clearTimeout(loop);
                run();
            }
            display.runFor = function(milliseconds) {
                var stoptime = Date.now() + milliseconds;
                do {
                    display.runNow();
                } while (Date.now() < stoptime);
            };
            run();
        },
        function readProgress(value) {display.showProgress(value)});
    }, 0);
};

function processOptions(options) {
    var search = decodeURIComponent(window.location.hash).slice(1),
        args = search && search.split("&");
    if (args) for (var i = 0; i < args.length; i++) {
        var keyAndVal = args[i].split("="),
            key = keyAndVal[0],
            val = keyAndVal[1];
        try { val = JSON.parse(val); } catch(e) {
            if (val[0] === "[") val = val.slice(1,-1).split(","); // handle string arrays
            // if not JSON use string itself
         };
        options[key] = val;
    }
    var root = Squeak.splitFilePath(options.root || "/").fullname;
    Squeak.dirCreate(root, true);
    if (!/\/$/.test(root)) root += "/";
    options.root = root;
    if (options.url && options.files && !options.image)
        options.image = options.url + "/" + options.files[0];
    if (!options.appName) options.appName = options.image ? 
        options.image.replace(/.*\//, "").replace(/\.image$/, "") : "SqueakJS";
    if (options.templates) {
        if (options.templates.constructor === Array) {
            var templates = {};
            options.templates.forEach(function(path){ templates[path] = path; });
            options.templates = templates;
        }
        for (var path in options.templates)
            Squeak.fetchTemplateDir(options.root + path, options.templates[path]);
    }
}

SqueakJS.runSqueak = function(imageUrl, canvas, options) {
    processOptions(options);
    SqueakJS.options = options;
    SqueakJS.appName = options.appName;
    if (options.image) imageUrl = options.image;
    else options.image = imageUrl;
    Squeak.fsck();
    var display = createSqueakDisplay(canvas, options),
        imageName = Squeak.splitFilePath(imageUrl).basename,
        imageData = null,
        baseUrl = imageUrl.replace(/[^\/]*$/, ""),
        files = [{url: imageUrl, name: imageName}];
    if (options.files) {
        options.files.forEach(function(f) { if (f !== imageName) files.push({url: baseUrl + f, name: f}); });
    }
    if (options.document) {
        var docName = Squeak.splitFilePath(options.document).basename;
        files.push({url: options.document, name: docName});
        display.documentName = options.root + docName;
    }
    function getNextFile(whenAllDone) {
        if (files.length === 0) return whenAllDone(imageData);
        var file = files.shift();
        if (Squeak.fileExists(options.root + file.name)) {
            if (file.name == imageName) {
                Squeak.fileGet(options.root + file.name, function(data) {
                    imageData = data;
                    getNextFile(whenAllDone);
                }, function onError() {
                    Squeak.fileDelete(options.root + file.name);
                    files.unshift(file);
                    getNextFile(whenAllDone);
                });
            } else getNextFile(whenAllDone);
            return;
        }
        display.showBanner("Downloading " + file.name);
        var rq = new XMLHttpRequest();
        rq.open('GET', file.url);
        rq.responseType = 'arraybuffer';
        rq.onprogress = function(e) {
            if (e.lengthComputable) display.showProgress(e.loaded / e.total);
        }
        rq.onload = function(e) {
            if (rq.status == 200) {
                if (file.name == imageName) {imageData = rq.response;}
                Squeak.filePut(options.root + file.name, rq.response, function() {
                    getNextFile(whenAllDone);
                });
            }
            else rq.onerror(rq.statusText);
        };
        rq.onerror = function(e) {
            alert("Failed to download:\n" + file.url);
        }
        rq.send();
    };
    getNextFile(function whenAllDone(imageData) {
        SqueakJS.runImage(imageData, options.root + imageName, display, options);
    });
};

SqueakJS.quitSqueak = function() {
    SqueakJS.vm.quitFlag = true;
};

SqueakJS.onQuit = function(vm, display, options) {
    window.onbeforeunload = null;
    if (options.spinner) options.spinner.style.display = "none";
    if (options.onQuit) options.onQuit(vm, display, options);
    else display.showBanner(SqueakJS.appName + " stopped.");
};

}); // end module

//////////////////////////////////////////////////////////////////////////////
// browser stuff 
//////////////////////////////////////////////////////////////////////////////

if (window.applicationCache) {
    applicationCache.addEventListener('updateready', function() {
        applicationCache.swapCache();
        var appName = SqueakJS && SqueakJS.appName || "SqueakJS";
        if (confirm(appName + ' has been updated. Restart now?')) {
            window.onbeforeunload = null;
            window.location.reload();
        }
    });
}

/***** including ../vm.js *****/

module('users.bert.SqueakJS.vm').requires().toRun(function() {
/*
 * Copyright (c) 2013,2014 Bert Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
 
// shorter name for convenience
window.Squeak = users.bert.SqueakJS.vm;

Object.extend(Squeak, {
    // system attributes
    vmVersion: "SqueakJS 0.6.4",
    vmBuild: "unknown",                 // replace at runtime by last-modified?
    vmPath: "/",
    vmFile: "vm.js",
    platformName: "Web",
    platformSubtype: "unknown",
    osVersion: navigator.userAgent,     // might want to parse
    windowSystem: "HTML",

    // object headers
    HeaderTypeMask: 3,
    HeaderTypeSizeAndClass: 0, //3-word header
    HeaderTypeClass: 1,        //2-word header
    HeaderTypeFree: 2,         //free block
    HeaderTypeShort: 3,        //1-word header
    
    // Indices into SpecialObjects array
    splOb_NilObject: 0,
    splOb_FalseObject: 1,
    splOb_TrueObject: 2,
    splOb_SchedulerAssociation: 3,
    splOb_ClassBitmap: 4,
    splOb_ClassInteger: 5,
    splOb_ClassString: 6,
    splOb_ClassArray: 7,
    splOb_SmalltalkDictionary: 8,
    splOb_ClassFloat: 9,
    splOb_ClassMethodContext: 10,
    splOb_ClassBlockContext: 11,
    splOb_ClassPoint: 12,
    splOb_ClassLargePositiveInteger: 13,
    splOb_TheDisplay: 14,
    splOb_ClassMessage: 15,
    splOb_ClassCompiledMethod: 16,
    splOb_TheLowSpaceSemaphore: 17,
    splOb_ClassSemaphore: 18,
    splOb_ClassCharacter: 19,
    splOb_SelectorDoesNotUnderstand: 20,
    splOb_SelectorCannotReturn: 21,
    splOb_TheInputSemaphore: 22,
    splOb_SpecialSelectors: 23,
    splOb_CharacterTable: 24,
    splOb_SelectorMustBeBoolean: 25,
    splOb_ClassByteArray: 26,
    splOb_ClassProcess: 27,
    splOb_CompactClasses: 28,
    splOb_TheTimerSemaphore: 29,
    splOb_TheInterruptSemaphore: 30,
    splOb_FloatProto: 31,
    splOb_SelectorCannotInterpret: 34,
    splOb_MethodContextProto: 35,
    splOb_ClassBlockClosure: 36,
    splOb_BlockContextProto: 37,
    splOb_ExternalObjectsArray: 38,
    splOb_ClassPseudoContext: 39,
    splOb_ClassTranslatedMethod: 40,
    splOb_TheFinalizationSemaphore: 41,
    splOb_ClassLargeNegativeInteger: 42,
    splOb_ClassExternalAddress: 43,
    splOb_ClassExternalStructure: 44,
    splOb_ClassExternalData: 45,
    splOb_ClassExternalFunction: 46,
    splOb_ClassExternalLibrary: 47,
    splOb_SelectorAboutToReturn: 48,
    splOb_SelectorRunWithIn: 49,
    
    // Class layout:
    Class_superclass: 0,
    Class_mdict: 1,
    Class_format: 2,
    Class_instVars: null,   // 3 or 4 depending on image, see instVarNames()
    Class_name: 6,
    // Context layout:
    Context_sender: 0,
    Context_instructionPointer: 1,
    Context_stackPointer: 2,
    Context_method: 3,
    Context_closure: 4,
    Context_receiver: 5,
    Context_tempFrameStart: 6,
    Context_smallFrameSize: 17,
    Context_largeFrameSize: 57,
    BlockContext_caller: 0,
    BlockContext_argumentCount: 3,
    BlockContext_initialIP: 4,
    BlockContext_home: 5,
    // Closure layout:
    Closure_outerContext: 0,
	Closure_startpc: 1,
	Closure_numArgs: 2,
	Closure_firstCopiedValue: 3,
    // Stream layout:
    Stream_array: 0,
    Stream_position: 1,
    Stream_limit: 2,
    //ProcessorScheduler layout:
    ProcSched_processLists: 0,
    ProcSched_activeProcess: 1,
    //Link layout:
    Link_nextLink: 0,
    //LinkedList layout:
    LinkedList_firstLink: 0,
    LinkedList_lastLink: 1,
    //Semaphore layout:
    Semaphore_excessSignals: 2,
    //Process layout:
    Proc_suspendedContext: 1,
    Proc_priority: 2,
    Proc_myList: 3,	
    // Association layout:
    Assn_key: 0,
    Assn_value: 1,
    // MethodDict layout:
    MethodDict_array: 1,
    MethodDict_selectorStart: 2,
    // Message layout
    Message_selector: 0,
    Message_arguments: 1,
    Message_lookupClass: 2,
    // Point layout:
    Point_x: 0,
    Point_y: 1,
    // LargetInteger layout:
    LargeInteger_bytes: 0,
    LargeInteger_neg: 1,
    // BitBlt layout:
    BitBlt_dest: 0,
    BitBlt_source: 1,
    BitBlt_halftone: 2,
    BitBlt_combinationRule: 3,
    BitBlt_destX: 4,
    BitBlt_destY: 5,
    BitBlt_width: 6,
    BitBlt_height: 7,
    BitBlt_sourceX: 8,
    BitBlt_sourceY: 9,
    BitBlt_clipX: 10,
    BitBlt_clipY: 11,
    BitBlt_clipW: 12,
    BitBlt_clipH: 13,
    BitBlt_colorMap: 14,
    BitBlt_warpBase: 15,
    // Form layout:
    Form_bits: 0,
    Form_width: 1,
    Form_height: 2,
    Form_depth: 3,
    
    // Event constants
    Mouse_Blue: 1,
    Mouse_Yellow: 2,
    Mouse_Red: 4,
    Keyboard_Shift: 8,
    Keyboard_Ctrl: 16,
    Keyboard_Alt: 32,
    Keyboard_Cmd: 64,
    Mouse_All: 1 + 2 + 4,
    Keyboard_All: 8 + 16 + 32 + 64,
    EventTypeNone: 0,
    EventTypeMouse: 1,
    EventTypeKeyboard: 2,
    EventKeyChar: 0,
    EventKeyDown: 1,
    EventKeyUp: 2,

    // other constants
    MinSmallInt: -0x40000000,
    MaxSmallInt:  0x3FFFFFFF,
    NonSmallInt: -0x50000000,           // non-small and neg (so non pos32 too)
    MillisecondClockMask: 0x1FFFFFFF,
    Epoch: Date.UTC(1901,0,1) + (new Date()).getTimezoneOffset()*60000,        // local timezone
    EpochUTC: Date.UTC(1901,0,1),
});

Object.extend(Squeak, {
    // don't clobber registered modules
    externalModules: Squeak.externalModules || {},
    registerExternalModule: function(name, module) {
        this.externalModules[name] = module;
    },
});

Object.subclass('Squeak.Image',
'about', {
    about: function() {
    /*
    Object Format
    =============
    Each Squeak object is a Squeak.Object instance, only SmallIntegers are JS numbers.
    Instance variables/fields reference other objects directly via the "pointers" property.
    {
        sqClass: reference to class object
        format: format integer as in Squeak oop header
        hash: identity hash integer
        pointers: (optional) Array referencing inst vars + indexable fields
        words: (optional) Array of numbers (words)
        bytes: (optional) Array of numbers (bytes)
        float: (optional) float value if this is a Float object
        isNil: (optional) true if this is the nil object
        isTrue: (optional) true if this is the true object
        isFalse: (optional) true if this is the false object
        isFloat: (optional) true if this is a Float object
        isFloatClass: (optional) true if this is the Float class
        isCompact: (optional) true if this is a compact class
        oop: identifies this object in a snapshot (assigned on GC, new space object oops are negative)
        mark: boolean (used only during GC, otherwise false)
        nextObject: linked list of objects in old space (new space objects do not have this yet)
    }

    Object Table
    ============
    There is no actual object table. Instead, objects in old space are a linked list.
    New objects are only referenced by other objects' pointers, and thus can be garbage-collected
    at any time by the Javascript GC.
    
    There is no support for weak references yet.

    */    
    }
},
'initializing', {
    initialize: function(name) {
        this.totalMemory = 100000000; 
        this.name = name;
        this.gcCount = 0;
        this.gcTenured = 0;
        this.gcCompacted = 0;
        this.gcMilliseconds = 0;
        this.allocationCount = 0;
        this.oldSpaceCount = 0;
        this.newSpaceCount = 0;
        this.hasNewInstances = {};
    },
    readFromBuffer: function(arraybuffer, thenDo, progressDo) {
        console.log('squeak: reading ' + this.name + ' (' + arraybuffer.byteLength + ' bytes)');
        this.startupTime = Date.now();
        var data = new DataView(arraybuffer),
            littleEndian = false,
            pos = 0;
        var readWord = function() {
            var int = data.getUint32(pos, littleEndian);
            pos += 4;
            return int;
        };
        var readBits = function(nWords, format) {
            if (format < 5) { // pointers (do endian conversion)
                var oops = [];
                while (oops.length < nWords)
                    oops.push(readWord());
                return oops;
            } else { // words (no endian conversion yet)
                var bits = new Uint32Array(arraybuffer, pos, nWords);
                pos += nWords*4;
                return bits;
            }
        };
        // read version and determine endianness
        var versions = [6502, 6504, 6505, 68000, 68002, 68003],
            version = readWord();
        if (versions.indexOf(version) < 0) {
            littleEndian = true; pos = 0;
            version = readWord();
            if (versions.indexOf(version) < 0) throw Error("bad image version");
        }
        var nativeFloats = (version & 1) != 0;
        this.hasClosures = version == 6504 || version == 68002 || nativeFloats;
        if (version >= 68000) throw Error("64 bit images not supported yet");

        // read header
        var imageHeaderSize = readWord();
        var objectMemorySize = readWord(); //first unused location in heap
        var oldBaseAddr = readWord(); //object memory base address of image
        var specialObjectsOopInt = readWord(); //oop of array of special oops
        this.lastHash = readWord(); //Should be loaded from, and saved to the image header
        var savedWindowSize = readWord();
        var fullScreenFlag = readWord();
        var extraVMMemory = readWord();
        pos += imageHeaderSize - (9 * 4); //skip to end of header
        // read objects
        var prevObj;
        var oopMap = {};
        while (pos < imageHeaderSize + objectMemorySize) {
            var nWords = 0;
            var classInt = 0;
            var header = readWord();
            switch (header & Squeak.HeaderTypeMask) {
                case Squeak.HeaderTypeSizeAndClass:
                    nWords = header >> 2;
                    classInt = readWord();
                    header = readWord();
                    break;
                case Squeak.HeaderTypeClass:
                    classInt = header - Squeak.HeaderTypeClass;
                    header = readWord();
                    nWords = (header >> 2) & 63;
                    break;
                case Squeak.HeaderTypeShort:
                    nWords = (header >> 2) & 63;
                    classInt = (header >> 12) & 31; //compact class index
                    //Note classInt<32 implies compact class index
                    break;
                case Squeak.HeaderTypeFree:
                    throw Error("Unexpected free block");
            }
            nWords--;  //length includes base header which we have already read
            var oop = pos - 4 - imageHeaderSize, //0-rel byte oop of this object (base header)
                format = (header>>8) & 15,
                hash = (header>>17) & 4095,
                bits = readBits(nWords, format);

            var object = new Squeak.Object();
            object.initFromImage(oop, classInt, format, hash, bits);
            if (classInt < 32) object.hash |= 0x10000000;    // see fixCompactOops()
            if (prevObj) prevObj.nextObject = object;
            this.oldSpaceCount++;
            prevObj = object;
            //oopMap is from old oops to actual objects
            oopMap[oldBaseAddr + oop] = object;
        }
        this.firstOldObject = oopMap[oldBaseAddr+4];
        this.lastOldObject = prevObj;
        this.oldSpaceBytes = objectMemorySize;
        //create proper objects by mapping via oopMap
        var splObs         = oopMap[specialObjectsOopInt];
        var compactClasses = oopMap[splObs.bits[Squeak.splOb_CompactClasses]].bits;
        var floatClass     = oopMap[splObs.bits[Squeak.splOb_ClassFloat]];
        var obj = this.firstOldObject,
            done = 0,
            self = this;
        function mapSomeObjects() {
            if (obj) {
                var stop = done + (self.oldSpaceCount / 10 | 0);    // do it in 10 chunks
                while (obj && done < stop) {
                    obj.installFromImage(oopMap, compactClasses, floatClass, littleEndian, nativeFloats);
                    obj = obj.nextObject;
                    done++;
                }
                if (progressDo) progressDo(done / self.oldSpaceCount);
                return true;    // do more
            } else { // done
                self.specialObjectsArray = splObs;
                self.decorateKnownObjects();
                self.fixCompactOops();
                return false;   // don't do more
            }
        };
        if (!progressDo) {
            while (mapSomeObjects());   // do it synchronously
            if (thenDo) thenDo();
        } else {
            function mapSomeObjectsAsync() {
                if (mapSomeObjects()) {
                    window.setTimeout(mapSomeObjectsAsync, 0);
                } else {
                    if (thenDo) thenDo();
                }
            };
            window.setTimeout(mapSomeObjectsAsync, 0);
        }
     },
    decorateKnownObjects: function() {
        var splObjs = this.specialObjectsArray.pointers;
        splObjs[Squeak.splOb_NilObject].isNil = true;
        splObjs[Squeak.splOb_TrueObject].isTrue = true;
        splObjs[Squeak.splOb_FalseObject].isFalse = true;
        splObjs[Squeak.splOb_ClassFloat].isFloatClass = true;
        this.compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers;
        for (var i = 0; i < this.compactClasses.length; i++)
            if (!this.compactClasses[i].isNil)
                this.compactClasses[i].isCompact = true;
        if (!Number.prototype.sqInstName)
            Object.defineProperty(Number.prototype, 'sqInstName', {
                enumerable: false,
                value: function() { return this.toString() }
            });
    },
    fixCompactOops: function() {
        // instances of compact classes might have been saved with a non-compact header
        // fix their oops here so validation succeeds later
        var obj = this.firstOldObject,
            adjust = 0;
        while (obj) {
            var hadCompactHeader = obj.hash > 0x0FFFFFFF,
                mightBeCompact = !!obj.sqClass.isCompact;
            if (hadCompactHeader !== mightBeCompact) {
                var isCompact = obj.snapshotSize().header === 0;
                if (hadCompactHeader !== isCompact) {
                    adjust += isCompact ? -4 : 4;
                }
            }
            obj.hash &= 0x0FFFFFFF;
            obj.oop += adjust;
            obj = obj.nextObject;
        }
        this.oldSpaceBytes += adjust;
    },
},
'garbage collection', {
    partialGC: function() {
        // no partial GC needed since new space uses the Javascript GC
        return this.totalMemory - this.oldSpaceBytes;
    },
    fullGC: function(reason) {
        // Collect garbage and return first tenured object (to support object enumeration)
        // Old space is a linked list of objects - each object has an "nextObject" reference.
        // New space objects do not have that pointer, they are garbage-collected by JavaScript.
        // But they have an allocation id so the survivors can be ordered on tenure.
        // The "nextObject" references are created by collecting all new objects, 
        // sorting them by id, and then linking them into old space.

        this.vm.addMessage("fullGC: " + reason);
        var start = Date.now();
        var newObjects = this.markReachableObjects();
        var removedObjects = this.removeUnmarkedOldObjects();
        this.appendToOldObjects(newObjects);
        this.oldSpaceCount += newObjects.length - removedObjects.length;
        this.allocationCount += this.newSpaceCount;
        this.newSpaceCount = 0;
        this.hasNewInstances = {};
        this.gcCount++;
        this.gcTenured += newObjects.length;
        this.gcCompacted += removedObjects.length;
        this.gcMilliseconds += Date.now() - start;
        return newObjects.length > 0 ? newObjects[0] : null;
    },
    markReachableObjects: function() {
        // Visit all reachable objects and mark them.
        // Return surviving new objects
        // Contexts are handled specially: they have garbage beyond the stack pointer
        // which must not be traced, and is cleared out here
        this.vm.storeContextRegisters();        // update active context
        var todo = [this.specialObjectsArray, this.vm.activeContext];
        var newObjects = [];
        while (todo.length > 0) {
            var object = todo.pop();
            if (object.mark) continue;             // objects are added to todo more than once 
            if (!object.nextObject && object !== this.lastOldObject)       // it's a new object
                newObjects.push(object);
            object.mark = true;           // mark it
            if (!object.sqClass.mark)     // trace class if not marked
                todo.push(object.sqClass);
            var body = object.pointers;
            if (body) {                   // trace all unmarked pointers
                var n = body.length;
                if (this.vm.isContext(object))      // contexts have garbage beyond SP
                    n = object.contextSizeWithStack();
                for (var i = 0; i < n; i++)
                    if (typeof body[i] === "object" && !body[i].mark)      // except SmallInts
                        todo.push(body[i]);
                while (n < body.length)             // clean garbage from contexts 
                    body[n++] = this.vm.nilObj;
            }
        }
        // sort by oop to preserve creation order
        return newObjects.sort(function(a,b){return b.oop - a.oop});
    },
    removeUnmarkedOldObjects: function() {
        // Unlink unmarked old objects from the nextObject linked list
        // Reset marks of remaining objects, and adjust their oops
        // Set this.lastOldObject to last old object
        // Return removed old objects (to support finalization later)
        var removed = [],
            removedBytes = 0,
            obj = this.firstOldObject;
        obj.mark = false; // we know the first object (nil) was marked
        while (true) {
            var next = obj.nextObject;
            if (!next) {// we're done
                this.lastOldObject = obj;
                this.oldSpaceBytes -= removedBytes;
                return removed;
            }
            // if marked, continue with next object
            if (next.mark) {
                next.mark = false;     // unmark for next GC
                next.oop -= removedBytes;
                obj = next;
            } else { // otherwise, remove it
                var corpse = next; 
                obj.nextObject = corpse.nextObject; // drop from list
                removedBytes += corpse.totalBytes(); 
                removed.push(corpse);
            }
        }
    },
    appendToOldObjects: function(newObjects) {
        // append new objects to linked list of old objects
        // and unmark them
        var oldObj = this.lastOldObject;
        for (var i = 0; i < newObjects.length; i++) {
            var newObj = newObjects[i];
            newObj.mark = false;
            this.oldSpaceBytes = newObj.setAddr(this.oldSpaceBytes);     // add at end of memory
            oldObj.nextObject = newObj;
            oldObj = newObj;
        }
        this.lastOldObject = oldObj;
    },
},
'creating', {
    registerObject: function(obj) {
        // We don't actually register the object yet, because that would prevent
        // it from being garbage-collected by the Javascript collector
        obj.oop = -(++this.newSpaceCount); // temp oops are negative. Real oop assigned when surviving GC
        // Note this is also done in loadImageSegment()
        this.lastHash = (13849 + (27181 * this.lastHash)) & 0xFFFFFFFF;
        return this.lastHash & 0xFFF;
    },
    instantiateClass: function(aClass, indexableSize, filler) {
        var newObject = new Squeak.Object();
        var hash = this.registerObject(newObject);
        newObject.initInstanceOf(aClass, indexableSize, hash, filler);
        this.hasNewInstances[aClass.oop] = true;   // need GC to find all instances
        return newObject;
    },
    clone: function(object) {
        var newObject = new Squeak.Object();
        var hash = this.registerObject(newObject);
        newObject.initAsClone(object, hash);
        this.hasNewInstances[newObject.sqClass.oop] = true;   // need GC to find all instances
        return newObject;
    },
},
'operations', {
    bulkBecome: function(fromArray, toArray, twoWay, copyHash) {
        if (!fromArray)
            return !toArray;
        var n = fromArray.length;
        if (n !== toArray.length)
            return false;
        // need to visit all objects, so ensure new objects have
        // nextObject pointers and permanent oops
        if (this.newSpaceCount > 0)
            this.fullGC("become");              // does update context
        else
            this.vm.storeContextRegisters();    // still need to update active context
        // obj.oop used as dict key here is why we store them
        // rather than just calculating at image snapshot time
        var mutations = {};
        for (var i = 0; i < n; i++) {
            var obj = fromArray[i];
            if (!obj.sqClass) return false;  //non-objects in from array
            if (mutations[obj.oop]) return false; //repeated oops in from array
            else mutations[obj.oop] = toArray[i];
        }
        if (twoWay) for (var i = 0; i < n; i++) {
            var obj = toArray[i];
            if (!obj.sqClass) return false;  //non-objects in to array
            if (mutations[obj.oop]) return false; //repeated oops in to array
            else mutations[obj.oop] = fromArray[i];
        }
        // unless copyHash is false, make hash stay with the reference, not with the object
        if (copyHash) for (var i = 0; i < n; i++) {
            var fromHash = fromArray[i].hash;
            fromArray[i].hash = toArray[i].hash;
            toArray[i].hash = fromHash;
        }
        // Now, for every object...
        var obj = this.firstOldObject;
        while (obj) {
            // mutate the class
            var mut = mutations[obj.sqClass.oop];
            if (mut) obj.sqClass = mut;
            // and mutate body pointers
            var body = obj.pointers;
            if (body) for (var j = 0; j < body.length; j++) {
                mut = mutations[body[j].oop];
                if (mut) body[j] = mut;
            }
            obj = obj.nextObject;
        }
        this.vm.flushMethodCacheAfterBecome(mutations);
        return true;
    },
    objectAfter: function(obj) {
        // if this was the last old object, tenure new objects and try again
        return obj.nextObject || (this.newSpaceCount > 0 && this.fullGC("nextObject"));
    },
    someInstanceOf: function(clsObj) {
        var obj = this.firstOldObject;
        while (true) {
            if (obj.sqClass === clsObj)
                return obj;
            obj = obj.nextObject || this.nextObjectWithGCFor(clsObj);
            if (!obj) return null;
        }
    },
    nextInstanceAfter: function(obj) {
        var clsObj = obj.sqClass;
        while (true) {
            obj = obj.nextObject || this.nextObjectWithGCFor(clsObj);
            if (!obj) return null;
            if (obj.sqClass === clsObj)
                return obj;
        }
    },
    nextObjectWithGCFor: function(clsObj) {
        if (this.newSpaceCount === 0 || !this.hasNewInstances[clsObj.oop]) return null;
        return this.fullGC("instance of " + clsObj.className());
    },
    writeToBuffer: function() {
        var headerSize = 64,
            data = new DataView(new ArrayBuffer(headerSize + this.oldSpaceBytes)),
            pos = 0;
        var writeWord = function(word) {
            data.setUint32(pos, word);
            pos += 4;
        };
        writeWord(this.formatVersion()); // magic number
        writeWord(headerSize);
        writeWord(this.oldSpaceBytes); // end of memory
        writeWord(this.firstOldObject.addr()); // base addr (0)
        writeWord(this.objectToOop(this.specialObjectsArray));
        writeWord(this.lastHash);
        writeWord((800 << 16) + 600);  // window size
        while (pos < headerSize)
            writeWord(0);
        // objects
        var obj = this.firstOldObject,
            n = 0;
        while (obj) {
            pos = obj.writeTo(data, pos, this);
            obj = obj.nextObject;
            n++;
        }
        if (pos !== data.byteLength) throw Error("wrong image size");
        if (n !== this.oldSpaceCount) throw Error("wrong object count");
        return data.buffer;
    },
    objectToOop: function(obj) {
        // unsigned word for use in snapshot
        if (typeof obj ===  "number")
            return obj << 1 | 1; // add tag bit
        if (obj.oop < 0) throw Error("temporary oop");
        return obj.oop;
    },
    bytesLeft: function() {
        return this.totalMemory - this.oldSpaceBytes;
    },
    formatVersion: function() {
        return this.hasClosures ? 6504 : 6502;
    },
    segmentVersion: function() {
        var dnu = this.specialObjectsArray.pointers[Squeak.splOb_SelectorDoesNotUnderstand],
            wholeWord = new Uint32Array(dnu.bytes.buffer, 0, 1);
        return this.formatVersion() | (wholeWord[0] & 0xFF000000);
    },
    loadImageSegment: function(segmentWordArray, outPointerArray) {
        // The C VM creates real objects from the segment in-place. We need to create
        // real objects, which we just put in new space.
        // The code below is almost the same as readFromBuffer() ... should unify
        var data = new DataView(segmentWordArray.words.buffer),
            littleEndian = false,
            nativeFloats = false,
            pos = 0;
        var readWord = function() {
            var int = data.getUint32(pos, littleEndian);
            pos += 4;
            return int;
        };
        var readBits = function(nWords, format) {
            if (format < 5) { // pointers (do endian conversion)
                var oops = [];
                while (oops.length < nWords)
                    oops.push(readWord());
                return oops;
            } else { // words (no endian conversion yet)
                var bits = new Uint32Array(data.buffer, pos, nWords);
                pos += nWords * 4;
                return bits;
            }
        };
        // check version
        var version = readWord();
        if (version & 0xFFFF !== 6502) {
            littleEndian = true; pos = 0;
            version = readWord();
            if (version & 0xFFFF !== 6502) {
                console.error("image segment format not supported");
                return null;
            }
        }
        if (version >> 16 !== this.vm.image.segmentVersion() >> 16) {
            console.error("image segment format not supported");
            return null;
        }
        // read objects
        var segment = [],
            oopMap = {};
        while (pos < data.byteLength) {
            var nWords = 0,
                classInt = 0,
                header = readWord();
            switch (header & Squeak.HeaderTypeMask) {
                case Squeak.HeaderTypeSizeAndClass:
                    nWords = header >> 2;
                    classInt = readWord();
                    header = readWord();
                    break;
                case Squeak.HeaderTypeClass:
                    classInt = header - Squeak.HeaderTypeClass;
                    header = readWord();
                    nWords = (header >> 2) & 63;
                    break;
                case Squeak.HeaderTypeShort:
                    nWords = (header >> 2) & 63;
                    classInt = (header >> 12) & 31; //compact class index
                    //Note classInt<32 implies compact class index
                    break;
                case Squeak.HeaderTypeFree:
                    throw Error("Unexpected free block");
            }
            nWords--;  //length includes base header which we have already read
            var oop = pos, //0-rel byte oop of this object (base header)
                format = (header>>8) & 15,
                hash = (header>>17) & 4095,
                bits = readBits(nWords, format);

            var object = new Squeak.Object();
            object.initFromImage(oop, classInt, format, hash, bits);
            segment.push(object);
            oopMap[oop] = object;
        }
        // add outPointers to oopMap
        for (var i = 0; i < outPointerArray.pointers.length; i++)
            oopMap[0x80000004 + i * 4] = outPointerArray.pointers[i];
        // add compactClasses to oopMap
        var compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers,
            fakeClsOop = 0, // make up a compact-classes array with oops, as if loading an image
            compactClassOops = compactClasses.map(function(cls) {
                oopMap[--fakeClsOop] = cls; return fakeClsOop; });
        // map objects using oopMap, and assign new oops
        var roots = oopMap[8] || oopMap[12] || oopMap[16],      // might be 1/2/3 header words
            floatClass = this.specialObjectsArray.pointers[Squeak.splOb_ClassFloat],
            obj = roots;
        for (var i = 0; i < segment.length; i++) {
            var obj = segment[i];
            obj.installFromImage(oopMap, compactClassOops, floatClass, littleEndian, nativeFloats);
            obj.oop = -(++this.newSpaceCount);  // make this a proper new-space object (see registerObject)
        }
        // don't truncate segmentWordArray now like the C VM does. It does not seem to be
        // worth the trouble of adjusting the following oops
        return roots;
    },
});

Object.subclass('Squeak.Object',
'initialization', {
    initInstanceOf: function(aClass, indexableSize, hash, nilObj) {
        this.sqClass = aClass;
        this.hash = hash;
        var instSpec = aClass.pointers[Squeak.Class_format],
            instSize = ((instSpec>>1) & 0x3F) + ((instSpec>>10) & 0xC0) - 1; //0-255
        this.format = (instSpec>>7) & 0xF; //This is the 0-15 code

        if (this.format < 8) {
            if (this.format != 6) {
                if (instSize + indexableSize > 0)
                    this.pointers = this.fillArray(instSize + indexableSize, nilObj);
            } else // Words
                if (indexableSize > 0)
                    if (aClass.isFloatClass) {
                        this.isFloat = true;
                        this.float = 0.0;
                    } else
                        this.words = new Uint32Array(indexableSize); 
        } else // Bytes
            if (indexableSize > 0) {
                // this.format |= -indexableSize & 3;       //deferred to writeTo()
                this.bytes = new Uint8Array(indexableSize); //Methods require further init of pointers
            }

//      Definition of Squeak's format code...
//
//      Pointers only...
//        0      no fields
//        1      fixed fields only (all containing pointers)
//        2      indexable fields only (all containing pointers)
//        3      both fixed and indexable fields (all containing pointers)
//        4      both fixed and indexable weak fields (all containing pointers).
//        5      unused
//      Bits only...
//        6      indexable word fields only (no pointers)
//        7      unused
//        8-11   indexable byte fields only (no pointers) (low 2 bits are low 2 bits of size)
//      Pointer and bits (CompiledMethods only)...
//       12-15   compiled methods:
//               # of literal oops specified in method header,
//               followed by indexable bytes (same interpretation of low 2 bits as above)
    },
    initAsClone: function(original, hash) {
        this.sqClass = original.sqClass;
        this.hash = hash;
        this.format = original.format;
        if (original.isFloat) {
            this.isFloat = original.isFloat;
            this.float = original.float;
        } else {
            if (original.pointers) this.pointers = original.pointers.slice(0);   // copy
            if (original.words) this.words = new Uint32Array(original.words);    // copy
            if (original.bytes) this.bytes = new Uint8Array(original.bytes);     // copy
        }
    },
    initFromImage: function(oop, cls, fmt, hsh, data) {
        // initial creation from Image, with unmapped data
        this.oop = oop;
        this.sqClass = cls;
        this.format = fmt;
        this.hash = hsh;
        this.bits = data;
    },
    installFromImage: function(oopMap, ccArray, floatClass, littleEndian, nativeFloats) {
        //Install this object by decoding format, and rectifying pointers
        var ccInt = this.sqClass;
        // map compact classes
        if ((ccInt>0) && (ccInt<32))
            this.sqClass = oopMap[ccArray[ccInt-1]];
        else
            this.sqClass = oopMap[ccInt];
        var nWords = this.bits.length;
        if (this.format < 5) {
            //Formats 0...4 -- Pointer fields
            if (nWords > 0) {
                var oops = this.bits; // endian conversion was already done
                this.pointers = this.decodePointers(nWords, oops, oopMap);
            }
        } else if (this.format >= 12) {
            //Formats 12-15 -- CompiledMethods both pointers and bits
            var methodHeader = this.decodeWords(1, this.bits, littleEndian)[0],
                numLits = (methodHeader>>10) & 255,
                oops = this.decodeWords(numLits+1, this.bits, littleEndian);
            this.pointers = this.decodePointers(numLits+1, oops, oopMap); //header+lits
            this.bytes = this.decodeBytes(nWords-(numLits+1), this.bits, numLits+1, this.format & 3);
        } else if (this.format >= 8) {
            //Formats 8..11 -- ByteArrays (and ByteStrings)
            if (nWords > 0)
                this.bytes = this.decodeBytes(nWords, this.bits, 0, this.format & 3);
        } else if (this.sqClass == floatClass) {
            //These words are actually a Float
            this.isFloat = true;
            this.float = this.decodeFloat(this.bits, littleEndian, nativeFloats);
            if (this.float == 1.3797216632888e-310) {
                if (/noFloatDecodeWorkaround/.test(window.location.hash)) {
                    // floatDecode workaround disabled
                } else {
                    this.constructor.prototype.decodeFloat = this.decodeFloatDeoptimized;
                    this.float = this.decodeFloat(this.bits, littleEndian, nativeFloats);
                    if (this.float == 1.3797216632888e-310)
                        throw Error("Cannot deoptimize decodeFloat");
                } 
            }
        } else {
            if (nWords > 0)
                this.words = this.decodeWords(nWords, this.bits, littleEndian);
        }
        delete this.bits;
        this.mark = false; // for GC
    },
    decodePointers: function(nWords, theBits, oopMap) {
        //Convert small ints and look up object pointers in oopMap
        var ptrs = new Array(nWords);
        for (var i = 0; i < nWords; i++) {
            var oop = theBits[i];
            if ((oop & 1) === 1) {          // SmallInteger
                ptrs[i] = oop >> 1;
            } else {                        // Object
                ptrs[i] = oopMap[oop] || 42424242;
                // when loading a context from image segment, there is
                // garbage beyond its stack pointer, resulting in the oop
                // not being found in oopMap. We just fill in an arbitrary
                // SmallInteger - it's never accessed anyway
            }
        }
        return ptrs;        
    },
    decodeWords: function(nWords, theBits, littleEndian) {
        var data = new DataView(theBits.buffer, theBits.byteOffset),
            words = new Uint32Array(nWords);
        for (var i = 0; i < nWords; i++)
            words[i] = data.getUint32(i*4, littleEndian);
        return words;
    },
    decodeBytes: function (nWords, theBits, wordOffset, fmtLowBits) {
        // Adjust size for low bits and make a copy
        var nBytes = (nWords * 4) - fmtLowBits,
            wordsAsBytes = new Uint8Array(theBits.buffer, theBits.byteOffset + wordOffset * 4, nBytes),
            bytes = new Uint8Array(nBytes);
        bytes.set(wordsAsBytes);
        return bytes;
    },
    decodeFloat: function(theBits, littleEndian, nativeFloats) {
        var data = new DataView(theBits.buffer, theBits.byteOffset);
        // it's either big endian ...
        if (!littleEndian) return data.getFloat64(0, false);
        // or real little endian
        if (nativeFloats) return data.getFloat64(0, true);
        // or little endian, but with swapped words
        var buffer = new ArrayBuffer(8),
            swapped = new DataView(buffer);
        swapped.setUint32(0, data.getUint32(4));
        swapped.setUint32(4, data.getUint32(0));
        return swapped.getFloat64(0, true);
    },
    decodeFloatDeoptimized: function(theBits, littleEndian, nativeFloats) {
        var data = new DataView(theBits.buffer, theBits.byteOffset);
        // it's either big endian ...
        if (!littleEndian) return data.getFloat64(0, false);
        // or real little endian
        if (nativeFloats) return data.getFloat64(0, true);
        // or little endian, but with swapped words
        var buffer = new ArrayBuffer(8),
            swapped = new DataView(buffer);
        // wrap in function to defeat Safari's optimizer, which always
        // answers 1.3797216632888e-310 if called more than 25000 times
        (function() {
            swapped.setUint32(0, data.getUint32(4));
            swapped.setUint32(4, data.getUint32(0));
        })();
        return swapped.getFloat64(0, true);
    },
    fillArray: function(length, filler) {
        for (var array = [], i = 0; i < length; i++)
            array[i] = filler;
        return array;
    },
},
'printing', {
    toString: function() {
        return this.sqInstName();
    },
    bytesAsString: function() {
        if (!this.bytes) return '';
    	return Squeak.bytesAsString(this.bytes);
    },
    bytesAsNumberString: function(negative) {
        if (!this.bytes) return '';
        var hex = '0123456789ABCDEF',
            digits = [],
            value = 0;
        for (var i = this.bytes.length - 1; i >= 0; i--) {
            digits.push(hex[this.bytes[i] >> 4]);
            digits.push(hex[this.bytes[i] & 15]);
            value = value * 256 + this.bytes[i];
        }
        var sign = negative ? '-' : '',
            approx = value >= 9007199254740992 ? '≈' : '';
        return sign + '16r' + digits.join('') + ' (' + approx + sign + value + 'L)';
    },
    assnKeyAsString: function() {
        return this.pointers[Squeak.Assn_key].bytesAsString();  
    },
    slotNameAt: function(index) {
        // one-based index
        var instSize = this.instSize();
        if (index <= instSize)
            return this.sqClass.allInstVarNames()[index - 1];
        else
            return (index - instSize).toString();
    },
    sqInstName: function() {
        if (this.isNil) return "nil";
        if (this.isTrue) return "true";
        if (this.isFalse) return "false";
        if (this.isFloat) {var str = this.float.toString(); if (!/\./.test(str)) str += '.0'; return str; }
        var className = this.sqClass.className();
        if (/ /.test(className))
            return 'the ' + className;
        switch (className) {
            case 'String':
            case 'ByteString': return "'" + this.bytesAsString() + "'";
            case 'Symbol':
            case 'ByteSymbol':  return "#" + this.bytesAsString();         
            case 'Point': return this.pointers.join("@");
            case 'Rectangle': return this.pointers.join(" corner: ");
            case 'Association':
            case 'ReadOnlyVariableBinding': return this.pointers.join("->");
            case 'LargePositiveInteger': return this.bytesAsNumberString(false);
            case 'LargeNegativeInteger': return this.bytesAsNumberString(true);
            case 'Character': return "$" + String.fromCharCode(this.pointers[0]) + " (" + this.pointers[0].toString() + ")";
        }
        return  /^[aeiou]/i.test(className) ? 'an ' + className : 'a ' + className;
    },
},
'accessing', {
    isWords: function() {
        return this.format === 6;
    },
    isBytes: function() {
        var fmt = this.format;
        return fmt >= 8 && fmt <= 11;
    },
    isWordsOrBytes: function() {
        var fmt = this.format;
        return fmt == 6  || (fmt >= 8 && fmt <= 11);
    },
    isPointers: function() {
        return this.format <= 4;
    },
    isMethod: function() {
        return this.format >= 12;
    },
    pointersSize: function() {
    	return this.pointers ? this.pointers.length : 0;
    },
    bytesSize: function() {
        return this.bytes ? this.bytes.length : 0;
    },
    wordsSize: function() {
        return this.isFloat ? 2 : this.words ? this.words.length : 0;
    },
    instSize: function() {//same as class.classInstSize, but faster from format
        if (this.format>4 || this.format==2) return 0; //indexable fields only
        if (this.format<2) return this.pointers.length; //indexable fields only
        return this.sqClass.classInstSize(); //0-255
    },
    floatData: function() {
        var buffer = new ArrayBuffer(8);
        var data = new DataView(buffer);
        data.setFloat64(0, this.float, false);
        //1st word is data.getUint32(0, false);
        //2nd word is data.getUint32(4, false);
        return data;
    },
    wordsAsFloat32Array: function() {
        return this.float32Array
            || (this.words && (this.float32Array = new Float32Array(this.words.buffer)));
    },
    wordsAsFloat64Array: function() {
        return this.float64Array
            || (this.words && (this.float64Array = new Float64Array(this.words.buffer)));
    },
    wordsAsInt32Array: function() {
        return this.int32Array
            || (this.words && (this.int32Array = new Int32Array(this.words.buffer)));
    },
    wordsAsInt16Array: function() {
        return this.int16Array
            || (this.words && (this.int16Array = new Int16Array(this.words.buffer)));
    },
    wordsAsUint16Array: function() {
        return this.uint16Array
            || (this.words && (this.uint16Array = new Uint16Array(this.words.buffer)));
    },
    wordsAsUint8Array: function() {
        return this.uint8Array
            || (this.words && (this.uint8Array = new Uint8Array(this.words.buffer)));
    },
    wordsOrBytes: function() {
        if (this.words) return this.words;
        if (this.uint32Array) return this.uint32Array;
        if (!this.bytes) return null;
        return this.uint32Array = new Uint32Array(this.bytes.buffer, 0, this.bytes.length >> 2);
    },
    setAddr: function(addr) {
        // Move this object to addr by setting its oop. Answer address after this object.
        // Used to assign an oop for the first time when tenuring this object during GC.
        // When compacting, the oop is adjusted directly, since header size does not change.
        var words = this.snapshotSize();
        this.oop = addr + words.header * 4;
        return addr + (words.header + words.body) * 4; 
    },
    snapshotSize: function() {
        // words of extra object header and body this object would take up in image snapshot
        // body size includes one header word that is always present
        var nWords =
            this.isFloat ? 2 :
            this.words ? this.words.length :
            this.pointers ? this.pointers.length : 0;
        // methods have both pointers and bytes
        if (this.bytes) nWords += (this.bytes.length + 3) >> 2;
        nWords++; // one header word always present
        var extraHeader = nWords > 63 ? 2 : this.sqClass.isCompact ? 0 : 1;
        return {header: extraHeader, body: nWords};
    },
    addr: function() { // start addr of this object in a snapshot
        return this.oop - this.snapshotSize().header * 4;
    },
    totalBytes: function() {
        // size in bytes this object would take up in image snapshot
        var words = this.snapshotSize();
        return (words.header + words.body) * 4;
    },
    writeTo: function(data, pos, image) {
        // Write 1 to 3 header words encoding type, class, and size, then instance data
        if (this.bytes) this.format |= -this.bytes.length & 3;
        var beforePos = pos,
            size = this.snapshotSize(),
            formatAndHash = ((this.format & 15) << 8) | ((this.hash & 4095) << 17);
        // write header words first
        switch (size.header) {
            case 2:
                data.setUint32(pos, size.body << 2 | Squeak.HeaderTypeSizeAndClass); pos += 4;
                data.setUint32(pos, this.sqClass.oop | Squeak.HeaderTypeSizeAndClass); pos += 4;
                data.setUint32(pos, formatAndHash | Squeak.HeaderTypeSizeAndClass); pos += 4;
                break;
            case 1:
                data.setUint32(pos, this.sqClass.oop | Squeak.HeaderTypeClass); pos += 4;
                data.setUint32(pos, formatAndHash | size.body << 2 | Squeak.HeaderTypeClass); pos += 4;
                break;
            case 0:
                var classIndex = image.compactClasses.indexOf(this.sqClass) + 1;
                data.setUint32(pos, formatAndHash | classIndex << 12 | size.body << 2 | Squeak.HeaderTypeShort); pos += 4;
        }
        // now write body, if any
        if (this.isFloat) {
            data.setFloat64(pos, this.float); pos += 8;
        } else if (this.words) {
            for (var i = 0; i < this.words.length; i++) {
                data.setUint32(pos, this.words[i]); pos += 4;
            }
        } else if (this.pointers) {
            for (var i = 0; i < this.pointers.length; i++) { 
                data.setUint32(pos, image.objectToOop(this.pointers[i])); pos += 4;
            }
        }
        // no "else" because CompiledMethods have both pointers and bytes
        if (this.bytes) {
            for (var i = 0; i < this.bytes.length; i++)
                data.setUint8(pos++, this.bytes[i]);
            // skip to next word
            pos += -this.bytes.length & 3;
        }
        // done
        if (pos !== beforePos + this.totalBytes()) throw Error("written size does not match");
        return pos;
    },
},
'as class', {
    classInstSize: function() {
        // this is a class, answer number of named inst vars
        var format = this.pointers[Squeak.Class_format];
        return ((format >> 10) & 0xC0) + ((format >> 1) & 0x3F) - 1;
    },
    instVarNames: function() {
        var index = this.pointers.length > 12 ? 4 : 
            this.pointers.length > 9 ? 3 : 4; // index changed in newer images
        return (this.pointers[index].pointers || []).map(function(each) {
            return each.bytesAsString();
        });
    },
    allInstVarNames: function() {
        var superclass = this.superclass();
        if (superclass.isNil)
            return this.instVarNames();
        else
            return superclass.allInstVarNames().concat(this.instVarNames());
    },
    superclass: function() {
        return this.pointers[0];
    },
    className: function() {
        if (!this.pointers) return "_NOTACLASS_";
        var name = this.pointers[6];
        if (name && name.bytes) return Squeak.bytesAsString(name.bytes);
        var name = this.pointers[7];
        if (name && name.bytes) return Squeak.bytesAsString(name.bytes);
        // must be meta class
        for (var clsIndex = 5; clsIndex <= 6; clsIndex++)
            for (var nameIndex = 6; nameIndex <= 7; nameIndex++) {
                var cls = this.pointers[clsIndex];
                if (cls.pointers) {
                    var name = cls.pointers[nameIndex];
                    if (name && name.bytes) return Squeak.bytesAsString(name.bytes) + " class";
                }
            }
        return "_SOMECLASS_";
    }
},
'as method', {
    methodHeader: function() {
        return this.pointers[0];
    },
    methodNumLits: function() {
        return this.pointers.length - 1;
    },
    methodNumArgs: function() {
        return (this.methodHeader()>>24) & 0xF;
    },
    methodPrimitiveIndex: function() {
        var primBits = (this.methodHeader()) & 0x300001FF;
        if (primBits > 0x1FF)
            return (primBits & 0x1FF) + (primBits >> 19);
        else
            return primBits;
    },
    methodClassForSuper: function() {//assn found in last literal
        var assn = this.pointers[this.methodNumLits()];
        return assn.pointers[Squeak.Assn_value];
    },
    methodNeedsLargeFrame: function() {
        return (this.methodHeader() & 0x20000) > 0; 
    },
    methodAddPointers: function(headerAndLits) {
        this.pointers = headerAndLits; 
    },
    methodTempCount: function() {
        return (this.methodHeader()>>18) & 63; 
    },
    methodGetLiteral: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header
    },
    methodGetSelector: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header 
    },
    methodSetLiteral: function(zeroBasedIndex, value) {
        this.pointers[1+zeroBasedIndex] = value; // step over header
    },
},
'as context',
{
    contextHome: function() {
        return this.contextIsBlock() ? this.pointers[Squeak.BlockContext_home] : this;
    },
    contextIsBlock: function() {
        return typeof this.pointers[Squeak.BlockContext_argumentCount] === 'number';
    },
    contextMethod: function() {
        return this.contextHome().pointers[Squeak.Context_method];
    },
    contextSender: function() {
        return this.pointers[Squeak.Context_sender];
    },
    contextSizeWithStack: function(vm) {
        // Actual context size is inst vars + stack size. Slots beyond that may contain garbage.
        // If passing in a VM, and this is the activeContext, use the VM's current value.
        if (vm && vm.activeContext === this)
            return vm.sp + 1;
        // following is same as decodeSqueakSP() but works without vm ref
        var sp = this.pointers[Squeak.Context_stackPointer];
        return Squeak.Context_tempFrameStart + (typeof sp === "number" ? sp : 0);
    },
});

Object.subclass('Squeak.Interpreter',
'initialization', {
    initialize: function(image, display) {
        console.log('squeak: initializing interpreter ' + Squeak.vmVersion);
        this.Squeak = Squeak;   // store locally to avoid dynamic lookup in Lively
        this.image = image;
        this.image.vm = this;
        this.primHandler = new Squeak.Primitives(this, display);
        this.loadImageState();
        this.hackImage();
        this.initVMState();
        this.loadInitialContext();
        this.initCompiler();
        console.log('squeak: ready');
    },
    loadImageState: function() {
        this.specialObjects = this.image.specialObjectsArray.pointers;
        this.specialSelectors = this.specialObjects[Squeak.splOb_SpecialSelectors].pointers;
        this.nilObj = this.specialObjects[Squeak.splOb_NilObject];
        this.falseObj = this.specialObjects[Squeak.splOb_FalseObject];
        this.trueObj = this.specialObjects[Squeak.splOb_TrueObject];
        this.hasClosures = this.image.hasClosures;
        this.globals = this.findGlobals();
        // hack for old image that does not support Unix files
        if (!this.hasClosures && !this.findMethod("UnixFileDirectory class>>pathNameDelimiter"))
            this.primHandler.emulateMac = true;
    },
    initVMState: function() {
        this.byteCodeCount = 0;
        this.sendCount = 0;
        this.interruptCheckCounter = 0;
        this.interruptCheckCounterFeedBackReset = 1000;
        this.interruptChecksEveryNms = 3;
        this.nextPollTick = 0;
        this.nextWakeupTick = 0;
        this.lastTick = 0;
        this.interruptKeycode = 2094;  //"cmd-."
        this.interruptPending = false;
        //this.pendingFinalizationSignals = 0;
        this.freeContexts = this.nilObj;
        this.freeLargeContexts = this.nilObj;
        this.reclaimableContextCount = 0;
        this.nRecycledContexts = 0;
        this.nAllocatedContexts = 0;
        this.methodCacheSize = 1024;
        this.methodCacheMask = this.methodCacheSize - 1;
        this.methodCacheRandomish = 0;
        this.methodCache = [];
        for (var i = 0; i < this.methodCacheSize; i++)
            this.methodCache[i] = {lkupClass: null, selector: null, method: null, primIndex: 0, argCount: 0, mClass: null};
        this.breakOutOfInterpreter = false;
        this.breakOutTick = 0;
        this.breakOnMethod = null; // method to break on
        this.breakOnNewMethod = false;
        this.breakOnContextChanged = false;
        this.breakOnContextReturned = null; // context to break on
        this.messages = {};
        this.startupTime = Date.now(); // base for millisecond clock
    },
    loadInitialContext: function() {
        var schedAssn = this.specialObjects[Squeak.splOb_SchedulerAssociation];
        var sched = schedAssn.pointers[Squeak.Assn_value];
        var proc = sched.pointers[Squeak.ProcSched_activeProcess];
        this.activeContext = proc.pointers[Squeak.Proc_suspendedContext];
        this.fetchContextRegisters(this.activeContext);
        this.reclaimableContextCount = 0;
    },
    findGlobals: function() {
        var smalltalk = this.specialObjects[Squeak.splOb_SmalltalkDictionary],
            smalltalkClass = smalltalk.sqClass.className();
        if (smalltalkClass === "Association") {
            smalltalk = smalltalk.pointers[1];
            smalltalkClass = smalltalk.sqClass.className();
        }
        if (smalltalkClass === "SystemDictionary")
            return smalltalk.pointers[1].pointers;
        if (smalltalkClass === "SmalltalkImage") {
            var globals = smalltalk.pointers[0],
                globalsClass = globals.sqClass.className();
            if (globalsClass === "SystemDictionary")
                return globals.pointers[1].pointers;
            if (globalsClass === "Environment")
                return globals.pointers[2].pointers[1].pointers
        }
        throw Error("cannot find global dict");
    },
    initCompiler: function() {
        if (!Squeak.Compiler)
            return console.warn("Squeak.Compiler not loaded, using interpreter only");
        // some JS environments disallow creating functions at runtime (e.g. FireFox OS apps)
        try {
            if (new Function("return 42")() !== 42)
                return console.warn("function constructor not working, disabling JIT");
        } catch (e) {
            return console.warn("disabling JIT: " + e);
        }
        // disable JIT on slow machines, which are likely memory-limited
        var kObjPerSec = this.image.oldSpaceCount / (this.startupTime - this.image.startupTime);
        if (kObjPerSec < 10)
            return console.warn("Slow machine detected (loaded " + (kObjPerSec*1000|0) + " objects/sec), using interpreter only");
        // compiler might decide to not handle current image
        try {
            console.log("squeak: initializing JIT compiler");
            this.compiler = new Squeak.Compiler(this);
        } catch(e) {
            console.warn("Compiler " + e);
        }
    },
    hackImage: function() {
        // hack methods to make work for now
        var returnSelf  = 256,
            returnTrue  = 257,
            returnFalse = 258,
            returnNil   = 259;
        [
            // Etoys fallback for missing translation files is hugely inefficient.
            // This speeds up opening a viewer by 10x (!)
            // Remove when we added translation files.
            {method: "String>>translated", primitive: returnSelf},
            {method: "String>>translatedInAllDomains", primitive: returnSelf},
            // Squeak: disable syntax highlighting for speed
            {method: "PluggableTextMorphPlus>>useDefaultStyler", primitive: returnSelf},
        ].forEach(function(each) {
            var m = this.findMethod(each.method);
            if (m) {
                m.pointers[0] |= each.primitive;
                console.warn("Hacking " + each.method);
            }
        }, this);
    },
},
'interpreting', {
    interpretOne: function(singleStep) {
        if (this.method.compiled) {
            if (singleStep) {
                if (!this.compiler.enableSingleStepping(this.method)) {
                    this.method.compiled = null;
                    return this.interpretOne(singleStep);
                }
                this.breakNow();
            }
            this.byteCodeCount += this.method.compiled(this);
            return;
        }
        var Squeak = this.Squeak; // avoid dynamic lookup of "Squeak" in Lively
        var b, b2;
        this.byteCodeCount++;
        b = this.nextByte();
        if (b < 128) // Chrome only optimized up to 128 cases
        switch (b) { /* The Main Bytecode Dispatch Loop */

            // load receiver variable
            case 0x00: case 0x01: case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07: 
            case 0x08: case 0x09: case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x0E: case 0x0F: 
                this.push(this.receiver.pointers[b&0xF]); return;

            // load temporary variable
            case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17: 
            case 0x18: case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: case 0x1F: 
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&0xF)]); return;

            // loadLiteral
            case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25: case 0x26: case 0x27: 
            case 0x28: case 0x29: case 0x2A: case 0x2B: case 0x2C: case 0x2D: case 0x2E: case 0x2F: 
            case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35: case 0x36: case 0x37: 
            case 0x38: case 0x39: case 0x3A: case 0x3B: case 0x3C: case 0x3D: case 0x3E: case 0x3F: 
                this.push(this.method.methodGetLiteral(b&0x1F)); return;

            // loadLiteralIndirect
            case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x47: 
            case 0x48: case 0x49: case 0x4A: case 0x4B: case 0x4C: case 0x4D: case 0x4E: case 0x4F: 
            case 0x50: case 0x51: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56: case 0x57: 
            case 0x58: case 0x59: case 0x5A: case 0x5B: case 0x5C: case 0x5D: case 0x5E: case 0x5F: 
                this.push((this.method.methodGetLiteral(b&0x1F)).pointers[Squeak.Assn_value]); return;

            // storeAndPop rcvr, temp
            case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66: case 0x67: 
                this.receiver.pointers[b&7] = this.pop(); return;
            case 0x68: case 0x69: case 0x6A: case 0x6B: case 0x6C: case 0x6D: case 0x6E: case 0x6F: 
                this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&7)] = this.pop(); return;

            // Quick push
            case 0x70: this.push(this.receiver); return;
            case 0x71: this.push(this.trueObj); return;
            case 0x72: this.push(this.falseObj); return;
            case 0x73: this.push(this.nilObj); return;
            case 0x74: this.push(-1); return;
            case 0x75: this.push(0); return;
            case 0x76: this.push(1); return;
            case 0x77: this.push(2); return;

            // Quick return
            case 0x78: this.doReturn(this.receiver); return;
            case 0x79: this.doReturn(this.trueObj); return;
            case 0x7A: this.doReturn(this.falseObj); return;
            case 0x7B: this.doReturn(this.nilObj); return;
            case 0x7C: this.doReturn(this.pop()); return;
            case 0x7D: this.doReturn(this.pop(), this.activeContext.pointers[Squeak.BlockContext_caller]); return; // blockReturn
            case 0x7E: this.nono(); return;
            case 0x7F: this.nono(); return;
        } else switch (b) { // Chrome only optimized up to 128 cases
            // Sundry
            case 0x80: this.extendedPush(this.nextByte()); return;
            case 0x81: this.extendedStore(this.nextByte()); return;
            case 0x82: this.extendedStorePop(this.nextByte()); return;
            // singleExtendedSend
            case 0x83: b2 = this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, false); return;
            case 0x84: this.doubleExtendedDoAnything(this.nextByte()); return;
            // singleExtendedSendToSuper
            case 0x85: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, true); return;
            // secondExtendedSend
            case 0x86: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&63), b2>>6, false); return;
            case 0x87: this.pop(); return;	// pop
            case 0x88: this.push(this.top()); return;	// dup
            // thisContext
            case 0x89: this.push(this.activeContext); this.reclaimableContextCount = 0; return;

            // Closures
            case 0x8A: this.pushNewArray(this.nextByte());   // create new temp vector
                return;
            case 0x8B: this.nono(); return;
            case 0x8C: b2 = this.nextByte(); // remote push from temp vector
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2]);
                return;
            case 0x8D: b2 = this.nextByte(); // remote store into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.top();
                return;
            case 0x8E: b2 = this.nextByte(); // remote store and pop into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.pop();
                return;
            case 0x8F: this.pushClosureCopy(); return;

            // Short jmp
            case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97: 
                this.pc += (b&7)+1; return;
            // Short conditional jump on false
            case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F: 
                this.jumpIfFalse((b&7)+1); return;
            // Long jump, forward and back
            case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xA7: 
                b2 = this.nextByte();
                this.pc += (((b&7)-4)*256 + b2);
                if ((b&7)<4)        // check for process switch on backward jumps (loops)
                    if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
                return;
            // Long conditional jump on true
            case 0xA8: case 0xA9: case 0xAA: case 0xAB:
                this.jumpIfTrue((b&3)*256 + this.nextByte()); return;
            // Long conditional jump on false
            case 0xAC: case 0xAD: case 0xAE: case 0xAF: 
                this.jumpIfFalse((b&3)*256 + this.nextByte()); return;

            // Arithmetic Ops... + - < > <= >= = ~=    * /  @ lshift: lxor: land: lor:
            case 0xB0: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) + this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;	// PLUS +
            case 0xB1: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) - this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;	// MINUS -
            case 0xB2: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) < this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LESS <
            case 0xB3: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) > this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GRTR >
            case 0xB4: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) <= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LEQ <=
            case 0xB5: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) >= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GEQ >=
            case 0xB6: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) === this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // EQU =
            case 0xB7: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) !== this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // NEQ ~=
            case 0xB8: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) * this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // TIMES *
            case 0xB9: this.success = true;
                if(!this.pop2AndPushIntResult(this.quickDivide(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide /
            case 0xBA: this.success = true;
                if(!this.pop2AndPushIntResult(this.mod(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // MOD \
            case 0xBB: this.success = true;
                if(!this.primHandler.primitiveMakePoint(1, true)) this.sendSpecial(b&0xF); return;  // MakePt int@int
            case 0xBC: this.success = true;
                if(!this.pop2AndPushIntResult(this.safeShift(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return; // bitShift:
            case 0xBD: this.success = true;
                if(!this.pop2AndPushIntResult(this.div(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide //
            case 0xBE: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) & this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitAnd:
            case 0xBF: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) | this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitOr:

            // at:, at:put:, size, next, nextPut:, ...
            case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5: case 0xC6: case 0xC7: 
            case 0xC8: case 0xC9: case 0xCA: case 0xCB: case 0xCC: case 0xCD: case 0xCE: case 0xCF: 
                if (!this.primHandler.quickSendOther(this.receiver, b&0xF))
                    this.sendSpecial((b&0xF)+16); return;

            // Send Literal Selector with 0, 1, and 2 args
            case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7: 
            case 0xD8: case 0xD9: case 0xDA: case 0xDB: case 0xDC: case 0xDD: case 0xDE: case 0xDF: 
                this.send(this.method.methodGetSelector(b&0xF), 0, false); return;
            case 0xE0: case 0xE1: case 0xE2: case 0xE3: case 0xE4: case 0xE5: case 0xE6: case 0xE7: 
            case 0xE8: case 0xE9: case 0xEA: case 0xEB: case 0xEC: case 0xED: case 0xEE: case 0xEF: 
                this.send(this.method.methodGetSelector(b&0xF), 1, false); return;
            case 0xF0: case 0xF1: case 0xF2: case 0xF3: case 0xF4: case 0xF5: case 0xF6: case 0xF7: 
            case 0xF8: case 0xF9: case 0xFA: case 0xFB: case 0xFC: case 0xFD: case 0xFE: case 0xFF:
                this.send(this.method.methodGetSelector(b&0xF), 2, false); return;
        }
        throw Error("not a bytecode: " + b);
    },
    interpret: function(forMilliseconds, thenDo) {
        // run for a couple milliseconds (but only until idle or break)
        // answer milliseconds to sleep (until next timer wakeup)
        // or 'break' if reached breakpoint
        // call thenDo with that result when done
        if (this.frozen) return 'frozen';
        this.isIdle = false;
        this.breakOutOfInterpreter = false;
        this.breakOutTick = this.primHandler.millisecondClockValue() + (forMilliseconds || 500);
        while (this.breakOutOfInterpreter === false)
            if (this.method.compiled) {
                this.byteCodeCount += this.method.compiled(this);
            } else {
                this.interpretOne();
            }
        // this is to allow 'freezing' the interpreter and restarting it asynchronously. See freeze()
        if (typeof this.breakOutOfInterpreter == "function")
            return this.breakOutOfInterpreter(thenDo);
        // normally, we answer regularly
        var result = this.breakOutOfInterpreter == 'break' ? 'break'
            : !this.isIdle ? 0
            : !this.nextWakeupTick ? 'sleep'        // all processes waiting
            : Math.max(1, this.nextWakeupTick - this.primHandler.millisecondClockValue());
        if (thenDo) thenDo(result);
        return result;
    },
    goIdle: function() {
        // make sure we tend to pending delays
        var hadTimer = this.nextWakeupTick !== 0;
        this.forceInterruptCheck();
        this.checkForInterrupts();
        var hasTimer = this.nextWakeupTick !== 0;
        // go idle unless a timer just expired
        this.isIdle = hasTimer || !hadTimer;
        this.breakOut();
    },
    freeze: function() {
        // Stop the interpreter. Answer a function that can be
        // called to continue interpreting.
        var continueFunc;
        this.frozen = true;
        this.breakOutOfInterpreter = function(thenDo) {
            if (!thenDo) throw Error("need function to restart interpreter");
            continueFunc = thenDo;
            return "frozen";
        }.bind(this);
        return function unfreeze() {
            this.frozen = false;
            if (!continueFunc) throw Error("no continue function");
            continueFunc(0);    //continue without timeout
        }.bind(this);
    },
    breakOut: function() {
        this.breakOutOfInterpreter = this.breakOutOfInterpreter || true; // do not overwrite break string
    },
    nextByte: function() {
        return this.methodBytes[this.pc++];
    },
    nono: function() {
        throw Error("Oh No!");
    },
    forceInterruptCheck: function() {
        this.interruptCheckCounter = -1000;
    },
    checkForInterrupts: function() {
        //Check for interrupts at sends and backward jumps
        var now = this.primHandler.millisecondClockValue();
        if (now < this.lastTick) { // millisecond clock wrapped
            this.nextPollTick = now + (this.nextPollTick - this.lastTick);
            this.breakOutTick = now + (this.breakOutTick - this.lastTick);
            if (this.nextWakeupTick !== 0)
                this.nextWakeupTick = now + (this.nextWakeupTick - this.lastTick);
        }
        //Feedback logic attempts to keep interrupt response around 3ms...
        if (this.interruptCheckCounter > -100) { // only if not a forced check
            if ((now - this.lastTick) < this.interruptChecksEveryNms) { //wrapping is not a concern
                this.interruptCheckCounterFeedBackReset += 10;
            } else { // do a thousand sends even if we are too slow for 3ms
                if (this.interruptCheckCounterFeedBackReset <= 1000)
                    this.interruptCheckCounterFeedBackReset = 1000;
                else
                    this.interruptCheckCounterFeedBackReset -= 12;
            }
        }
    	this.interruptCheckCounter = this.interruptCheckCounterFeedBackReset; //reset the interrupt check counter
    	this.lastTick = now; //used to detect wraparound of millisecond clock
        //	if(signalLowSpace) {
        //            signalLowSpace= false; //reset flag
        //            sema= getSpecialObject(Squeak.splOb_TheLowSpaceSemaphore);
        //            if(sema != nilObj) synchronousSignal(sema); }
        //	if(now >= nextPollTick) {
        //            ioProcessEvents(); //sets interruptPending if interrupt key pressed
        //            nextPollTick= now + 500; } //msecs to wait before next call to ioProcessEvents"
        if (this.interruptPending) {
            this.interruptPending = false; //reset interrupt flag
            var sema = this.specialObjects[Squeak.splOb_TheInterruptSemaphore];
            if (!sema.isNil) this.primHandler.synchronousSignal(sema);
        }
        if ((this.nextWakeupTick !== 0) && (now >= this.nextWakeupTick)) {
            this.nextWakeupTick = 0; //reset timer interrupt
            var sema = this.specialObjects[Squeak.splOb_TheTimerSemaphore];
            if (!sema.isNil) this.primHandler.synchronousSignal(sema);
        }
        //	if (pendingFinalizationSignals > 0) { //signal any pending finalizations
        //            sema= getSpecialObject(Squeak.splOb_ThefinalizationSemaphore);
        //            pendingFinalizationSignals= 0;
        //            if(sema != nilObj) primHandler.synchronousSignal(sema); }
        if (this.primHandler.semaphoresToSignal.length > 0)
            this.primHandler.signalExternalSemaphores();  // signal pending semaphores, if any
        // if this is a long-running do-it, compile it
        if (!this.method.compiled && this.compiler)
            this.compiler.compile(this.method);
        // have to return to web browser once in a while
        if (now >= this.breakOutTick)
            this.breakOut();
    },
    extendedPush: function(nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.push(this.receiver.pointers[lobits]);break;
            case 1: this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits]); break;
            case 2: this.push(this.method.methodGetLiteral(lobits)); break;
            case 3: this.push(this.method.methodGetLiteral(lobits).pointers[Squeak.Assn_value]); break;
        }
    },
    extendedStore: function( nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.receiver.pointers[lobits] = this.top(); break;
            case 1: this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits] = this.top(); break;
            case 2: this.nono(); break;
            case 3: this.method.methodGetLiteral(lobits).pointers[Squeak.Assn_value] = this.top(); break;
        }
    },
    extendedStorePop: function(nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.receiver.pointers[lobits] = this.pop(); break;
            case 1: this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits] = this.pop(); break;
            case 2: this.nono(); break;
            case 3: this.method.methodGetLiteral(lobits).pointers[Squeak.Assn_value] = this.pop(); break;
        }
    },
    doubleExtendedDoAnything: function(byte2) {
        var byte3 = this.nextByte();
        switch (byte2>>5) {
            case 0: this.send(this.method.methodGetSelector(byte3), byte2&31, false); break;
            case 1: this.send(this.method.methodGetSelector(byte3), byte2&31, true); break;
            case 2: this.push(this.receiver.pointers[byte3]); break;
            case 3: this.push(this.method.methodGetLiteral(byte3)); break;
            case 4: this.push(this.method.methodGetLiteral(byte3).pointers[Squeak.Assn_value]); break;
            case 5: this.receiver.pointers[byte3] = this.top(); break;
            case 6: this.receiver.pointers[byte3] = this.pop(); break;
            case 7: this.method.methodGetLiteral(byte3).pointers[Squeak.Assn_value] = this.top(); break;
        }
    },
    jumpIfTrue: function(delta) {
        var top = this.pop();
        if (top.isTrue) {this.pc += delta; return;}
        if (top.isFalse) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Squeak.splOb_SelectorMustBeBoolean], 0, false);
    },
    jumpIfFalse: function(delta) {
        var top = this.pop();
        if (top.isFalse) {this.pc += delta; return;}
        if (top.isTrue) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Squeak.splOb_SelectorMustBeBoolean], 0, false);
    },
    sendSpecial: function(lobits) {
        this.send(this.specialSelectors[lobits*2],
            this.specialSelectors[(lobits*2)+1],
            false);  //specialSelectors is  {...sel,nArgs,sel,nArgs,...)
    },
},
'closures', {
    pushNewArray: function(nextByte) {
        var popValues = nextByte > 127,
            count = nextByte & 127,
            array = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], count);
        if (popValues) {
            for (var i = 0; i < count; i++)
                array.pointers[i] = this.stackValue(count - i - 1);
            this.popN(count);
        }
        this.push(array);
    },
    pushClosureCopy: function() {
        // The compiler has pushed the values to be copied, if any.  Find numArgs and numCopied in the byte following.
        // Create a Closure with space for the copiedValues and pop numCopied values off the stack into the closure.
        // Set numArgs as specified, and set startpc to the pc following the block size and jump over that code.
        var numArgsNumCopied = this.nextByte(),
            numArgs = numArgsNumCopied & 0xF,
            numCopied = numArgsNumCopied >> 4,
            blockSizeHigh = this.nextByte(),
            blockSize = blockSizeHigh * 256 + this.nextByte(),
            initialPC = this.encodeSqueakPC(this.pc, this.method),
            closure = this.newClosure(numArgs, initialPC, numCopied);
        closure.pointers[Squeak.Closure_outerContext] = this.activeContext;
        this.reclaimableContextCount = 0; // The closure refers to thisContext so it can't be reclaimed
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                closure.pointers[Squeak.Closure_firstCopiedValue + i] = this.stackValue(numCopied - i - 1);
            this.popN(numCopied);
        }
        this.pc += blockSize;
        this.push(closure);
	},
	newClosure: function(numArgs, initialPC, numCopied) {
        var size = Squeak.Closure_firstCopiedValue + numCopied,
            closure = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassBlockClosure], size);
        closure.pointers[Squeak.Closure_startpc] = initialPC;
        closure.pointers[Squeak.Closure_numArgs] = numArgs;
        return closure;
	},
},
'sending', {
    send: function(selector, argCount, doSuper) {
        var newRcvr = this.stackValue(argCount);
        var lookupClass = this.getClass(newRcvr);
        if (doSuper) {
            lookupClass = this.method.methodClassForSuper();
            lookupClass = lookupClass.pointers[Squeak.Class_superclass];
        }
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        if (entry.primIndex) {
            //note details for verification of at/atput primitives
            this.verifyAtSelector = selector;
            this.verifyAtClass = lookupClass;
        }
        this.executeNewMethod(newRcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
    },
    sendAsPrimitiveFailure: function(rcvr, method, argCount) {
        this.executeNewMethod(rcvr, method, argCount, 0);
    },
    findSelectorInClass: function(selector, argCount, startingClass) {
        var cacheEntry = this.findMethodCacheEntry(selector, startingClass);
        if (cacheEntry.method) return cacheEntry; // Found it in the method cache
        var currentClass = startingClass;
        var mDict;
        while (!currentClass.isNil) {
            mDict = currentClass.pointers[Squeak.Class_mdict];
            if (mDict.isNil) {
                // MethodDict pointer is nil (hopefully due a swapped out stub)
                //        -- send #cannotInterpret:
                var cantInterpSel = this.specialObjects[Squeak.splOb_SelectorCannotInterpret],
                    cantInterpMsg = this.createActualMessage(selector, argCount, startingClass);
                this.popNandPush(argCount, cantInterpMsg);
                return this.findSelectorInClass(cantInterpSel, 1, currentClass.superclass());
            }
            var newMethod = this.lookupSelectorInDict(mDict, selector);
            if (!newMethod.isNil) {
                this.currentSelector = selector;
                this.currentLookupClass = startingClass;
                //if method is not actually a CompiledMethod, invoke primitiveInvokeObjectAsMethod (248) instead
                cacheEntry.method = newMethod;
                cacheEntry.primIndex = newMethod.isMethod() ? newMethod.methodPrimitiveIndex() : 248;
                cacheEntry.argCount = argCount;
                cacheEntry.mClass = currentClass;
                return cacheEntry;
            }  
            currentClass = currentClass.superclass();
        }
        //Cound not find a normal message -- send #doesNotUnderstand:
        var dnuSel = this.specialObjects[Squeak.splOb_SelectorDoesNotUnderstand];
        if (selector === dnuSel) // Cannot find #doesNotUnderstand: -- unrecoverable error.
            throw Error("Recursive not understood error encountered");
        var dnuMsg = this.createActualMessage(selector, argCount, startingClass); //The argument to doesNotUnderstand:
        this.popNandPush(argCount, dnuMsg);
        return this.findSelectorInClass(dnuSel, 1, startingClass);
    },
    lookupSelectorInDict: function(mDict, messageSelector) {
        //Returns a method or nilObject
        var dictSize = mDict.pointersSize();
        var mask = (dictSize - Squeak.MethodDict_selectorStart) - 1;
        var index = (mask & messageSelector.hash) + Squeak.MethodDict_selectorStart;
        // If there are no nils (should always be), then stop looping on second wrap.
        var hasWrapped = false;
        while (true) {
            var nextSelector = mDict.pointers[index];
            if (nextSelector === messageSelector) {
                var methArray = mDict.pointers[Squeak.MethodDict_array];
                return methArray.pointers[index - Squeak.MethodDict_selectorStart];
            }
            if (nextSelector.isNil) return this.nilObj;
            if (++index === dictSize) {
                if (hasWrapped) return this.nilObj;
                index = Squeak.MethodDict_selectorStart;
                hasWrapped = true;
            }
        }
    },
    executeNewMethod: function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
        this.sendCount++;
        if (newMethod === this.breakOnMethod) this.breakNow("executing method " + this.printMethod(newMethod, optClass, optSel));
        if (this.logSends) console.log(this.sendCount + ' ' + this.printMethod(newMethod, optClass, optSel));
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
        if (primitiveIndex > 0)
            if (this.tryPrimitive(primitiveIndex, argumentCount, newMethod))
                return;  //Primitive succeeded -- end of story
        var newContext = this.allocateOrRecycleContext(newMethod.methodNeedsLargeFrame());
        var tempCount = newMethod.methodTempCount();
        var newPC = 0; // direct zero-based index into byte codes
        var newSP = Squeak.Context_tempFrameStart + tempCount - 1; // direct zero-based index into context pointers
        newContext.pointers[Squeak.Context_method] = newMethod;
        //Following store is in case we alloc without init; all other fields get stored
        newContext.pointers[Squeak.BlockContext_initialIP] = this.nilObj;
        newContext.pointers[Squeak.Context_sender] = this.activeContext;
        //Copy receiver and args to new context
        //Note this statement relies on the receiver slot being contiguous with args...
        this.arrayCopy(this.activeContext.pointers, this.sp-argumentCount, newContext.pointers, Squeak.Context_tempFrameStart-1, argumentCount+1);
        //...and fill the remaining temps with nil
        this.arrayFill(newContext.pointers, Squeak.Context_tempFrameStart+argumentCount, Squeak.Context_tempFrameStart+tempCount, this.nilObj);
        this.popN(argumentCount+1);
        this.reclaimableContextCount++;
        this.storeContextRegisters();
        /////// Woosh //////
        this.activeContext = newContext; //We're off and running...
        //Following are more efficient than fetchContextRegisters() in newActiveContext()
        this.homeContext = newContext;
        this.method = newMethod;
        this.methodBytes = newMethod.bytes;
        this.pc = newPC;
        this.sp = newSP;
        this.storeContextRegisters(); // not really necessary, I claim
        this.receiver = newContext.pointers[Squeak.Context_receiver];
        if (this.receiver !== newRcvr)
            throw Error("receivers don't match");
        if (!newMethod.compiled && this.compiler)
            this.compiler.compile(newMethod, optClass, optSel);
        // check for process switch on full method activation
        if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
    },
    doReturn: function(returnValue, targetContext) {
        // get sender from block home or closure's outerContext
        if (!targetContext) {
            var ctx = this.homeContext;
            if (this.hasClosures) {
                var closure;
                while (!(closure = ctx.pointers[Squeak.Context_closure]).isNil)
                    ctx = closure.pointers[Squeak.Closure_outerContext];
            }
            targetContext = ctx.pointers[Squeak.Context_sender];
        }
        if (targetContext.isNil || targetContext.pointers[Squeak.Context_instructionPointer].isNil)
            return this.cannotReturn(returnValue);
        // search up stack for unwind
        var thisContext = this.activeContext.pointers[Squeak.Context_sender];
        while (thisContext !== targetContext) {
            if (thisContext.isNil)
                return this.cannotReturn(returnValue);
            if (this.isUnwindMarked(thisContext))
                return this.aboutToReturnThrough(returnValue, thisContext);
            thisContext = thisContext.pointers[Squeak.Context_sender];
        }
        // no unwind to worry about, just peel back the stack (usually just to sender)
        var nextContext;
        thisContext = this.activeContext;
        while (thisContext !== targetContext) {
            if (this.breakOnContextReturned === thisContext) {
                this.breakOnContextReturned = null;
                this.breakNow();
            }
            nextContext = thisContext.pointers[Squeak.Context_sender];
            thisContext.pointers[Squeak.Context_sender] = this.nilObj;
            thisContext.pointers[Squeak.Context_instructionPointer] = this.nilObj;
            if (this.reclaimableContextCount > 0) {
                this.reclaimableContextCount--;
                this.recycleIfPossible(thisContext);
            }
            thisContext = nextContext;
        }
        this.activeContext = thisContext;
        this.fetchContextRegisters(this.activeContext);
        this.push(returnValue);
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
    },
    aboutToReturnThrough: function(resultObj, aContext) {
        this.reclaimableContextCount = 0;
    	this.push(this.activeContext);
    	this.push(resultObj);
    	this.push(aContext);
    	var aboutToReturnSel = this.specialObjects[Squeak.splOb_SelectorAboutToReturn];
    	this.send(aboutToReturnSel, 2);
    },
    cannotReturn: function(resultObj) {
        this.reclaimableContextCount = 0;
    	this.push(this.activeContext);
    	this.push(resultObj);
    	var cannotReturnSel = this.specialObjects[Squeak.splOb_SelectorCannotReturn];
    	this.send(cannotReturnSel, 1);
    },
    tryPrimitive: function(primIndex, argCount, newMethod) {
        if ((primIndex > 255) && (primIndex < 520)) {
            if (primIndex >= 264) {//return instvars
                this.popNandPush(1, this.top().pointers[primIndex - 264]);
                return true;
            }
            switch (primIndex) {
                case 256: //return self
                    return true;
                case 257: this.popNandPush(1, this.trueObj); //return true
                    return true;
                case 258: this.popNandPush(1, this.falseObj); //return false
                    return true;
                case 259: this.popNandPush(1, this.nilObj); //return nil
                    return true;
            }
            this.popNandPush(1, primIndex - 261); //return -1...2
            return true;
        }
        var success = this.primHandler.doPrimitive(primIndex, argCount, newMethod);
        return success;
    },
    createActualMessage: function(selector, argCount, cls) {
        //Bundle up receiver, args and selector as a messageObject
        var message = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMessage], 0);
        var argArray = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], argCount);
        this.arrayCopy(this.activeContext.pointers, this.sp-argCount+1, argArray.pointers, 0, argCount); //copy args from stack
        message.pointers[Squeak.Message_selector] = selector;
        message.pointers[Squeak.Message_arguments] = argArray;
        if (message.pointers.length > Squeak.Message_lookupClass) //Early versions don't have lookupClass
            message.pointers[Squeak.Message_lookupClass] = cls;
        return message;
    },
    primitivePerform: function(argCount) {
        var selector = this.stackValue(argCount-1);
        var rcvr = this.stackValue(argCount);
        // NOTE: findNewMethodInClass may fail and be converted to #doesNotUnderstand:,
        //       (Whoah) so we must slide args down on the stack now, so that would work
        var trueArgCount = argCount - 1;
        var selectorIndex = this.sp - trueArgCount;
        var stack = this.activeContext.pointers; // slide eveything down...
        this.arrayCopy(stack, selectorIndex+1, stack, selectorIndex, trueArgCount);
        this.sp--; // adjust sp accordingly
        var entry = this.findSelectorInClass(selector, trueArgCount, this.getClass(rcvr));
        this.executeNewMethod(rcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
        return true;
    },
    primitivePerformWithArgs: function(argCount, supered) {
        var rcvr = this.stackValue(argCount);
        var selector = this.stackValue(argCount - 1);
        var args = this.stackValue(argCount - 2);
        if (args.sqClass !== this.specialObjects[Squeak.splOb_ClassArray])
            return false;
        var lookupClass = supered ? this.stackValue(argCount - 3) : this.getClass(rcvr);
        if (supered) { // verify that lookupClass is in fact in superclass chain of receiver;
            var cls = this.getClass(rcvr);
            while (cls !== lookupClass) {
                cls = cls.pointers[Squeak.Class_superclass];
                if (cls.isNil) return false;
            }
        }
        var trueArgCount = args.pointersSize();
        var stack = this.activeContext.pointers;
        this.arrayCopy(args.pointers, 0, stack, this.sp - 1, trueArgCount);
        this.sp += trueArgCount - argCount; //pop selector and array then push args
        var entry = this.findSelectorInClass(selector, trueArgCount, lookupClass);
        this.executeNewMethod(rcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
        return true;
    },
    primitiveInvokeObjectAsMethod: function(argCount, method) {
        // invoked from VM if non-method found in lookup
        var orgArgs = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], argCount);
        for (var i = 0; i < argCount; i++)
            orgArgs.pointers[argCount - i - 1] = this.pop();
        var orgReceiver = this.pop(),
            orgSelector = this.currentSelector;
        // send run:with:in: to non-method object
        var runWithIn = this.specialObjects[Squeak.splOb_SelectorRunWithIn];
        this.push(method);       // not actually a method
        this.push(orgSelector);
        this.push(orgArgs);
        this.push(orgReceiver);
        this.send(runWithIn, 3, false);
        return true;
    },
    findMethodCacheEntry: function(selector, lkupClass) {
        //Probe the cache, and return the matching entry if found
        //Otherwise return one that can be used (selector and class set) with method == null.
        //Initial probe is class xor selector, reprobe delta is selector
        //We do not try to optimize probe time -- all are equally 'fast' compared to lookup
        //Instead we randomize the reprobe so two or three very active conflicting entries
        //will not keep dislodging each other
        var entry;
        this.methodCacheRandomish = (this.methodCacheRandomish + 1) & 3;
        var firstProbe = (selector.hash ^ lkupClass.hash) & this.methodCacheMask;
        var probe = firstProbe;
        for (var i = 0; i < 4; i++) { // 4 reprobes for now
            entry = this.methodCache[probe];
            if (entry.selector === selector && entry.lkupClass === lkupClass) return entry;
            if (i === this.methodCacheRandomish) firstProbe = probe;
            probe = (probe + selector.hash) & this.methodCacheMask;
        }
        entry = this.methodCache[firstProbe];
        entry.lkupClass = lkupClass;
        entry.selector = selector;
        entry.method = null;
        return entry;
    },
    flushMethodCache: function() { //clear all cache entries (prim 89)
        for (var i = 0; i < this.methodCacheSize; i++) {
            this.methodCache[i].selector = null;   // mark it free
            this.methodCache[i].method = null;  // release the method
        }
        return true;
    },
    flushMethodCacheForSelector: function(selector) { //clear cache entries for selector (prim 119)
        for (var i = 0; i < this.methodCacheSize; i++)
            if (this.methodCache[i].selector === selector) {
                this.methodCache[i].selector = null;   // mark it free
                this.methodCache[i].method = null;  // release the method
            }
        return true;
    },
    flushMethodCacheForMethod: function(method) { //clear cache entries for method (prim 116)
        for (var i = 0; i < this.methodCacheSize; i++)
            if (this.methodCache[i].method === method) {
                this.methodCache[i].selector = null;   // mark it free
                this.methodCache[i].method = null;  // release the method
            }
        return true;
    },
    flushMethodCacheAfterBecome: function(mutations) {
        // could be selective by checking lkupClass, selector,
        // and method against mutations dict
        this.flushMethodCache();
    },
},
'contexts', {
    isUnwindMarked: function(ctx) {
        if (!this.isMethodContext(ctx)) return false;
        var method = ctx.pointers[Squeak.Context_method];
        return method.methodPrimitiveIndex() == 198;
    },
    newActiveContext: function(newContext) {
        // Note: this is inlined in executeNewMethod() and doReturn()
        this.storeContextRegisters();
        this.activeContext = newContext; //We're off and running...
        this.fetchContextRegisters(newContext);
    },
    fetchContextRegisters: function(ctxt) {
        var meth = ctxt.pointers[Squeak.Context_method];
        if (this.isSmallInt(meth)) { //if the Method field is an integer, activeCntx is a block context
            this.homeContext = ctxt.pointers[Squeak.BlockContext_home];
            meth = this.homeContext.pointers[Squeak.Context_method];
        } else { //otherwise home==ctxt
            this.homeContext = ctxt;
        }
        this.receiver = this.homeContext.pointers[Squeak.Context_receiver];
        this.method = meth;
        this.methodBytes = meth.bytes;
        this.pc = this.decodeSqueakPC(ctxt.pointers[Squeak.Context_instructionPointer], meth);
        this.sp = this.decodeSqueakSP(ctxt.pointers[Squeak.Context_stackPointer]);
    },
    storeContextRegisters: function() {
        //Save pc, sp into activeContext object, prior to change of context
        //   see fetchContextRegisters for symmetry
        //   expects activeContext, pc, sp, and method state vars to still be valid
        this.activeContext.pointers[Squeak.Context_instructionPointer] = this.encodeSqueakPC(this.pc, this.method);
        this.activeContext.pointers[Squeak.Context_stackPointer] = this.encodeSqueakSP(this.sp);
    },
    encodeSqueakPC: function(intPC, method) {
        // Squeak pc is offset by header and literals
        // and 1 for z-rel addressing
        return intPC + method.pointers.length * 4 + 1;
    },
    decodeSqueakPC: function(squeakPC, method) {
        return squeakPC - method.pointers.length * 4 - 1;
    },
    encodeSqueakSP: function(intSP) {
        // sp is offset by tempFrameStart, -1 for z-rel addressing
        return intSP - (Squeak.Context_tempFrameStart - 1);
    },
    decodeSqueakSP: function(squeakSP) {
        return squeakSP + (Squeak.Context_tempFrameStart - 1);
    },
    recycleIfPossible: function(ctxt) {
        if (!this.isMethodContext(ctxt)) return;
        if (ctxt.pointersSize() === (Squeak.Context_tempFrameStart+Squeak.Context_smallFrameSize)) {
            // Recycle small contexts
            ctxt.pointers[0] = this.freeContexts;
            this.freeContexts = ctxt;
        } else { // Recycle large contexts
            if (ctxt.pointersSize() !== (Squeak.Context_tempFrameStart+Squeak.Context_largeFrameSize))
                return;
            ctxt.pointers[0] = this.freeLargeContexts;
            this.freeLargeContexts = ctxt;
        }
    },
    allocateOrRecycleContext: function(needsLarge) {
        //Return a recycled context or a newly allocated one if none is available for recycling."
        var freebie;
        if (needsLarge) {
            if (!this.freeLargeContexts.isNil) {
                freebie = this.freeLargeContexts;
                this.freeLargeContexts = freebie.pointers[0];
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMethodContext], Squeak.Context_largeFrameSize);
        } else {
            if (!this.freeContexts.isNil) {
                freebie = this.freeContexts;
                this.freeContexts = freebie.pointers[0];
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMethodContext], Squeak.Context_smallFrameSize);
        }
    },
},
'stack access', {
    pop: function() {
        //Note leaves garbage above SP.  Cleaned out by fullGC.
        return this.activeContext.pointers[this.sp--];  
    },
    popN: function(nToPop) {
        this.sp -= nToPop;
    },
    push: function(object) {
        this.activeContext.pointers[++this.sp] = object;
    },
    popNandPush: function(nToPop, object) {
        this.activeContext.pointers[this.sp -= nToPop - 1] = object;
    },
    top: function() {
        return this.activeContext.pointers[this.sp];
    },
    stackValue: function(depthIntoStack) {
        return this.activeContext.pointers[this.sp - depthIntoStack];
    },
    stackInteger: function(depthIntoStack) {
        return this.checkSmallInt(this.stackValue(depthIntoStack));
    },
    stackIntOrFloat: function(depthIntoStack) {
        var num = this.stackValue(depthIntoStack);
        // is it a SmallInt?
        if (typeof num === "number") return num;
        // is it a Float?
        if (num.isFloat) {
            this.resultIsFloat = true;   // need to return result as Float
            return num.float;
        }
        // maybe a 32-bit LargeInt?
        var bytes = num.bytes;
        if (bytes && bytes.length == 4) {
            var value = 0;
            for (var i = 3; i >= 0; i--)
                value = value * 256 + bytes[i];
            if (num.sqClass === this.specialObjects[Squeak.splOb_ClassLargePositiveInteger]) 
                return value;
            if (num.sqClass === this.specialObjects[Squeak.splOb_ClassLargeNegativeInteger]) 
                return -value;
        }
        // none of the above
        this.success = false;
        return 0;
    },
    pop2AndPushIntResult: function(intResult) {// returns success boolean
        if (this.success && this.canBeSmallInt(intResult)) {
            this.popNandPush(2, intResult);
            return true;
        }
        return false;
    },
    pop2AndPushNumResult: function(numResult) {// returns success boolean
        if (this.success) {
            if (this.resultIsFloat) {
                this.popNandPush(2, this.primHandler.makeFloat(numResult));
                return true;
            }
            if (numResult >= Squeak.MinSmallInt && numResult <= Squeak.MaxSmallInt) {
                this.popNandPush(2, numResult);
                return true;
            }
            if (numResult >= -0xFFFFFFFF && numResult <= 0xFFFFFFFF) {
                var negative = numResult < 0,
                    unsigned = negative ? -numResult : numResult,
                    lgIntClass = negative ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger,
                    lgIntObj = this.instantiateClass(this.specialObjects[lgIntClass], 4),
                    bytes = lgIntObj.bytes;
                bytes[0] = unsigned     & 255;
                bytes[1] = unsigned>>8  & 255;
                bytes[2] = unsigned>>16 & 255;
                bytes[3] = unsigned>>24 & 255;
                this.popNandPush(2, lgIntObj);
                return true;
            }
        }
        return false;
    },
    pop2AndPushBoolResult: function(boolResult) {
        if (!this.success) return false;
        this.popNandPush(2, boolResult ? this.trueObj : this.falseObj);
        return true;
    },
},
'numbers', {
    getClass: function(obj) {
        if (this.isSmallInt(obj))
            return this.specialObjects[Squeak.splOb_ClassInteger];
        return obj.sqClass;
    },
    canBeSmallInt: function(anInt) {
        return (anInt >= Squeak.MinSmallInt) && (anInt <= Squeak.MaxSmallInt);
    },
    isSmallInt: function(object) {
        return typeof object === "number";
    },
    checkSmallInt: function(maybeSmallInt) { // returns an int and sets success
        if (typeof maybeSmallInt === "number")
            return maybeSmallInt;
        this.success = false;
        return 1;
    },
    quickDivide: function(rcvr, arg) { // must only handle exact case
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        var result = rcvr / arg | 0;
        if (result * arg === rcvr) return result;
        return Squeak.NonSmallInt;     // fail if result is not exact
    },
    div: function(rcvr, arg) {
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        return Math.floor(rcvr/arg);
    },
    mod: function(rcvr, arg) {
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        return rcvr - Math.floor(rcvr/arg) * arg;
    },
    safeShift: function(smallInt, shiftCount) {
         // JS shifts only up to 31 bits
        if (shiftCount < 0) {
            if (shiftCount < -31) return smallInt < 0 ? -1 : 0;
            return smallInt >> -shiftCount; // OK to lose bits shifting right
        }
        if (shiftCount > 31) return smallInt == 0 ? 0 : Squeak.NonSmallInt;
        // check for lost bits by seeing if computation is reversible
        var shifted = smallInt << shiftCount;
        if  ((shifted>>shiftCount) === smallInt) return shifted;
        return Squeak.NonSmallInt;  //non-small result will cause failure
    },
},
'utils',
{
    isContext: function(obj) {//either block or methodContext
        if (obj.sqClass === this.specialObjects[Squeak.splOb_ClassMethodContext]) return true;
        if (obj.sqClass === this.specialObjects[Squeak.splOb_ClassBlockContext]) return true;
        return false;
    },
    isMethodContext: function(obj) {
        return obj.sqClass === this.specialObjects[Squeak.splOb_ClassMethodContext];
    },
    isMethod: function(obj, index) {
        return  obj.sqClass === this.specialObjects[Squeak.splOb_ClassCompiledMethod];
    },
    instantiateClass: function(aClass, indexableSize) {
        return this.image.instantiateClass(aClass, indexableSize, this.nilObj);
    },
    arrayFill: function(array, fromIndex, toIndex, value) {
        // assign value to range from fromIndex (inclusive) to toIndex (exclusive)
        for (var i = fromIndex; i < toIndex; i++)
            array[i] = value;
    },
    arrayCopy: function(src, srcPos, dest, destPos, length) {
        // copy length elements from src at srcPos to dest at destPos
        if (src === dest && srcPos < destPos)
            for (var i = length - 1; i >= 0; i--)
                dest[destPos + i] = src[srcPos + i];
        else
            for (var i = 0; i < length; i++)
                dest[destPos + i] = src[srcPos + i];
    },
},
'debugging', {
    addMessage: function(message) {
        return this.messages[message] ? ++this.messages[message] : this.messages[message] = 1;
    },
    warnOnce: function(message) {
        if (this.addMessage(message) == 1)
            console.warn(message);
    },
    printMethod: function(aMethod, optContext, optSel) {
        // return a 'class>>selector' description for the method
        if (optSel) return optContext.className() + '>>' + optSel.bytesAsString();
        // this is expensive, we have to search all classes
        if (!aMethod) aMethod = this.activeContext.contextMethod();
        var found;
        this.allMethodsDo(function(classObj, methodObj, selectorObj) {
            if (methodObj === aMethod)
                return found = classObj.className() + '>>' + selectorObj.bytesAsString();
        });
        if (found) return found;
        if (optContext) {
            var rcvr = optContext.pointers[Squeak.Context_receiver];
            return "(" + rcvr + ")>>?";
        }
        return "?>>?";
    },
    allInstancesOf: function(classObj, callback) {
        if (typeof classObj === "string") classObj = this.globalNamed(classObj);
        var instances = [],
            inst = this.image.someInstanceOf(classObj);
        while (inst) {
            if (callback) callback(inst);
            else instances.push(inst);
            inst = this.image.nextInstanceAfter(inst);
        }
        return instances;
    },
    globalNamed: function(name) {
        return this.allGlobalsDo(function(nameObj, globalObj){
            if (nameObj.bytesAsString() === name) return globalObj;
        });
    },
    allGlobalsDo: function(callback) {
        // callback(globalNameObj, globalObj) should return true to break out of iteration
        var globals = this.globals;
        for (var i = 0; i < globals.length; i++) {
            var assn = globals[i];
            if (!assn.isNil) {
                var result = callback(assn.pointers[0], assn.pointers[1]);
                if (result) return result;
            }
        }
    },
    allMethodsDo: function(callback) {
        // callback(classObj, methodObj, selectorObj) should return true to break out of iteration
        var self = this;
        this.allGlobalsDo(function(globalNameObj, globalObj) {
            if (globalObj.pointers && globalObj.pointers.length >= 9) {
                var clsAndMeta = [globalObj, globalObj.sqClass];
                for (var c = 0; c < clsAndMeta.length; c++) {
                    var cls = clsAndMeta[c];
                    var mdict = cls.pointers[1];
                    if (!mdict.pointers || !mdict.pointers[1]) continue;
                    var methods = mdict.pointers[1].pointers;
                    if (!methods) continue;
                    var selectors = mdict.pointers;
                    for (var j = 0; j < methods.length; j++) {
                        if (callback.call(this, cls, methods[j], selectors[2+j]))
                            return true;
                    }
                }
            }
        });
    },
    printStack: function(ctx, limit) {
        // both args are optional
        if (typeof ctx == "number") {limit = ctx; ctx = null;}
        if (!ctx) ctx = this.activeContext;
        if (!limit) limit = 100;
        var contexts = [],
            hardLimit = Math.max(limit, 1000000);
        while (!ctx.isNil && hardLimit-- > 0) {
            contexts.push(ctx);
            ctx = ctx.pointers[Squeak.Context_sender];
        }
        var extra = 200;
        if (contexts.length > limit + extra) {
            if (!ctx.isNil) contexts.push('...'); // over hard limit
            contexts = contexts.slice(0, limit).concat(['...']).concat(contexts.slice(-extra));
        }
        var stack = [],
            i = contexts.length;
        while (i-- > 0) {
            var ctx = contexts[i];
            if (!ctx.pointers) {
                stack.push('...\n');
            } else {
                var block = '',
                    method = ctx.pointers[Squeak.Context_method];
                if (typeof method === 'number') { // it's a block context, fetch home
                    method = ctx.pointers[Squeak.BlockContext_home].pointers[Squeak.Context_method];
                    block = '[] in ';
                } else if (!ctx.pointers[Squeak.Context_closure].isNil) {
                    block = '[] in '; // it's a closure activation
                }
                stack.push(block + this.printMethod(method, ctx) + '\n');
            }
        }
        return stack.join('');
    },
    findMethod: function(classAndMethodString) {
        // classAndMethodString is 'Class>>method'
        var found,
            className = classAndMethodString.split('>>')[0],
            methodName = classAndMethodString.split('>>')[1];
        this.allMethodsDo(function(classObj, methodObj, selectorObj) {
            if (methodName.length == selectorObj.bytesSize()
                && methodName == selectorObj.bytesAsString() 
                && className == classObj.className())
                    return found = methodObj;
        });
        return found;
    },
    breakNow: function(msg) {
        if (msg) console.log("Break: " + msg);
        this.breakOutOfInterpreter = 'break';
    },
    breakOn: function(classAndMethodString) {
        // classAndMethodString is 'Class>>method'
        return this.breakOnMethod = classAndMethodString && this.findMethod(classAndMethodString);
    },
    breakOnReturnFromThisContext: function() {
        this.breakOnContextChanged = false;
        this.breakOnContextReturned = this.activeContext;
    },
    breakOnSendOrReturn: function() {
        this.breakOnContextChanged = true;
        this.breakOnContextReturned = null;
    },
    printActiveContext: function() {
        // temps and stack in current context
        var ctx = this.activeContext;
        var isBlock = typeof ctx.pointers[Squeak.BlockContext_argumentCount] === 'number';
        var closure = ctx.pointers[Squeak.Context_closure];
        var isClosure = !isBlock && !closure.isNil;
        var homeCtx = isBlock ? ctx.pointers[Squeak.BlockContext_home] : ctx;
        var tempCount = isClosure
            ? closure.pointers[Squeak.Closure_numArgs]
            : homeCtx.pointers[Squeak.Context_method].methodTempCount();
        var stackBottom = this.decodeSqueakSP(0);
        var stackTop = homeCtx.contextSizeWithStack(this) - 1;
        var firstTemp = stackBottom + 1;
        var lastTemp = firstTemp + tempCount - 1;
        var stack = '';
        for (var i = stackBottom; i <= stackTop; i++) {
            var obj = homeCtx.pointers[i];
            var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
            var label = '';
            if (i == stackBottom) label = '=rcvr'; else
            if (i <= lastTemp) label = '=tmp' + (i - firstTemp);
            stack += '\nctx[' + i + ']' + label +': ' + value;
        }
        if (isBlock) {
            stack += '\n';
            var nArgs = ctx.pointers[3];
            var firstArg = this.decodeSqueakSP(1);
            var lastArg = firstArg + nArgs;
            for (var i = firstArg; i <= this.sp; i++) {
                var obj = ctx.pointers[i];
                var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
                var label = '';
                if (i <= lastArg) label = '=arg' + (i - firstArg);
                stack += '\nblk[' + i + ']' + label +': ' + value;
            }
        }
        return stack;
    },
    printAllProcesses: function() {
        var schedAssn = this.specialObjects[Squeak.splOb_SchedulerAssociation],
            sched = schedAssn.pointers[Squeak.Assn_value];
        // print active process
        var activeProc = sched.pointers[Squeak.ProcSched_activeProcess],
            result = "Active: " + this.printProcess(activeProc, true);
        // print other runnable processes
        var lists = sched.pointers[Squeak.ProcSched_processLists].pointers;
        for (var priority = lists.length - 1; priority >= 0; priority--) {
            var process = lists[priority].pointers[Squeak.LinkedList_firstLink];
            while (!process.isNil) {
                result += "\nRunnable: " + this.printProcess(process);
                process = process.pointers[Squeak.Link_nextLink];
            }
        }
        // print all processes waiting on a semaphore
        var semaClass = this.specialObjects[Squeak.splOb_ClassSemaphore],
            sema = this.image.someInstanceOf(semaClass);
        while (sema) {
            var process = sema.pointers[Squeak.LinkedList_firstLink];
            while (!process.isNil) {
                result += "\nWaiting: " + this.printProcess(process);
                process = process.pointers[Squeak.Link_nextLink];
            }
            sema = this.image.nextInstanceAfter(sema);
        }
        return result;
    },
    printProcess: function(process, active) {
        var context = process.pointers[Squeak.Proc_suspendedContext],
            priority = process.pointers[Squeak.Proc_priority],
            stack = this.printStack(active ? null : context);
        return process.toString() +" at priority " + priority + "\n" + stack;
    },
    printByteCodes: function(aMethod, optionalIndent, optionalHighlight, optionalPC) {
        if (!aMethod) aMethod = this.method;
        var printer = new Squeak.InstructionPrinter(aMethod, this);
        return printer.printInstructions(optionalIndent, optionalHighlight, optionalPC);
    },
    willSendOrReturn: function() {
        // Answer whether the next bytecode corresponds to a Smalltalk
        // message send or return
        var byte = this.method.bytes[this.pc];
        if (byte >= 120 && byte <= 125) return true; // return
        /* 
        if (byte < 96) return false;    // 96-103 storeAndPopReceiverVariableBytecode
        if (byte <= 111) return true;   // 104-111 storeAndPopTemporaryVariableBytecode
        if (byte == 129        // 129 extendedStoreBytecode
            || byte == 130     // 130 extendedStoreAndPopBytecode
            || byte == 141	   // 141 storeRemoteTempLongBytecode
            || byte == 142	   // 142 storeAndPopRemoteTempLongBytecode
            || (byte == 132 && 
                this.method.bytes[this.pc + 1] >= 160)) // 132 doubleExtendedDoAnythingBytecode
                    return true;
        */
        if (byte < 131 || byte == 200) return false;
        if (byte >= 176) return true; // special send or short send
        if (byte <= 134) {         // long sends
			// long form support demands we check the selector
			var litIndex;
			if (byte === 132) {
                if ((this.method.bytes[this.pc + 1] >> 5) > 1) return false;
                litIndex = this.method.bytes[this.pc + 2];
			} else
                litIndex = this.method.bytes[this.pc + 1] & (byte === 134 ? 63 : 31);
            var selectorObj = this.method.pointers[litIndex + 1];
            if (selectorObj.bytesAsString() != 'blockCopy:') return true;
        }
        return false;
    },
});

Object.subclass('Squeak.Primitives',
'initialization', {
    initialize: function(vm, display) {
        this.vm = vm;
        this.display = display;
        this.display.vm = this.vm;
        this.oldPrims = !this.vm.image.hasClosures;
        this.allowAccessBeyondSP = this.oldPrims;
        this.deferDisplayUpdates = false;
        this.semaphoresToSignal = [];
        this.initDisplay();
        this.initAtCache();
        this.initModules();
    },
    initModules: function() {
        this.loadedModules = {};
        this.builtinModules = {
            FilePlugin:             this.findPluginFunctions("", "primitive(Disable)?(File|Directory)"),
            SoundPlugin:            this.findPluginFunctions("snd_"),
            B2DPlugin:              this.findPluginFunctions("ge"),
            JPEGReadWriter2Plugin:  this.findPluginFunctions("jpeg2_"),
            SecurityPlugin: {
                primitiveDisableImageWrite: this.fakePrimitive.bind(this, "SecurityPlugin.primitiveDisableImageWrite", 0), 
            },
        };
        this.patchModules = {
            ScratchPlugin:          this.findPluginFunctions("scratch_"),
        };
        this.interpreterProxy = new Squeak.InterpreterProxy(this.vm);
    },
    findPluginFunctions: function(prefix, match, bindLate) {
        match = match || "(initialise|shutdown|prim)";
        var plugin = {},
            regex = new RegExp("^" + prefix + match, "i");
        for (var funcName in this)
            if (regex.test(funcName) && typeof this[funcName] == "function") {
                var primName = funcName;
                if (prefix) primName = funcName[prefix.length].toLowerCase() + funcName.slice(prefix.length + 1);
                plugin[primName] = bindLate ? funcName : this[funcName].bind(this);
            }
        return plugin;
    },
    initDisplay: function() {
        this.indexedColors = [
            0xFFFFFFFF, 0xFF000001, 0xFFFFFFFF, 0xFF808080, 0xFFFF0000, 0xFF00FF00, 0xFF0000FF, 0xFF00FFFF,
            0xFFFFFF00, 0xFFFF00FF, 0xFF202020, 0xFF404040, 0xFF606060, 0xFF9F9F9F, 0xFFBFBFBF, 0xFFDFDFDF,
            0xFF080808, 0xFF101010, 0xFF181818, 0xFF282828, 0xFF303030, 0xFF383838, 0xFF484848, 0xFF505050,
            0xFF585858, 0xFF686868, 0xFF707070, 0xFF787878, 0xFF878787, 0xFF8F8F8F, 0xFF979797, 0xFFA7A7A7,
            0xFFAFAFAF, 0xFFB7B7B7, 0xFFC7C7C7, 0xFFCFCFCF, 0xFFD7D7D7, 0xFFE7E7E7, 0xFFEFEFEF, 0xFFF7F7F7,
            0xFF000001, 0xFF003300, 0xFF006600, 0xFF009900, 0xFF00CC00, 0xFF00FF00, 0xFF000033, 0xFF003333,
            0xFF006633, 0xFF009933, 0xFF00CC33, 0xFF00FF33, 0xFF000066, 0xFF003366, 0xFF006666, 0xFF009966,
            0xFF00CC66, 0xFF00FF66, 0xFF000099, 0xFF003399, 0xFF006699, 0xFF009999, 0xFF00CC99, 0xFF00FF99, 
            0xFF0000CC, 0xFF0033CC, 0xFF0066CC, 0xFF0099CC, 0xFF00CCCC, 0xFF00FFCC, 0xFF0000FF, 0xFF0033FF, 
            0xFF0066FF, 0xFF0099FF, 0xFF00CCFF, 0xFF00FFFF, 0xFF330000, 0xFF333300, 0xFF336600, 0xFF339900, 
            0xFF33CC00, 0xFF33FF00, 0xFF330033, 0xFF333333, 0xFF336633, 0xFF339933, 0xFF33CC33, 0xFF33FF33, 
            0xFF330066, 0xFF333366, 0xFF336666, 0xFF339966, 0xFF33CC66, 0xFF33FF66, 0xFF330099, 0xFF333399, 
            0xFF336699, 0xFF339999, 0xFF33CC99, 0xFF33FF99, 0xFF3300CC, 0xFF3333CC, 0xFF3366CC, 0xFF3399CC,
            0xFF33CCCC, 0xFF33FFCC, 0xFF3300FF, 0xFF3333FF, 0xFF3366FF, 0xFF3399FF, 0xFF33CCFF, 0xFF33FFFF,
            0xFF660000, 0xFF663300, 0xFF666600, 0xFF669900, 0xFF66CC00, 0xFF66FF00, 0xFF660033, 0xFF663333,
            0xFF666633, 0xFF669933, 0xFF66CC33, 0xFF66FF33, 0xFF660066, 0xFF663366, 0xFF666666, 0xFF669966, 
            0xFF66CC66, 0xFF66FF66, 0xFF660099, 0xFF663399, 0xFF666699, 0xFF669999, 0xFF66CC99, 0xFF66FF99, 
            0xFF6600CC, 0xFF6633CC, 0xFF6666CC, 0xFF6699CC, 0xFF66CCCC, 0xFF66FFCC, 0xFF6600FF, 0xFF6633FF, 
            0xFF6666FF, 0xFF6699FF, 0xFF66CCFF, 0xFF66FFFF, 0xFF990000, 0xFF993300, 0xFF996600, 0xFF999900, 
            0xFF99CC00, 0xFF99FF00, 0xFF990033, 0xFF993333, 0xFF996633, 0xFF999933, 0xFF99CC33, 0xFF99FF33, 
            0xFF990066, 0xFF993366, 0xFF996666, 0xFF999966, 0xFF99CC66, 0xFF99FF66, 0xFF990099, 0xFF993399, 
            0xFF996699, 0xFF999999, 0xFF99CC99, 0xFF99FF99, 0xFF9900CC, 0xFF9933CC, 0xFF9966CC, 0xFF9999CC, 
            0xFF99CCCC, 0xFF99FFCC, 0xFF9900FF, 0xFF9933FF, 0xFF9966FF, 0xFF9999FF, 0xFF99CCFF, 0xFF99FFFF, 
            0xFFCC0000, 0xFFCC3300, 0xFFCC6600, 0xFFCC9900, 0xFFCCCC00, 0xFFCCFF00, 0xFFCC0033, 0xFFCC3333, 
            0xFFCC6633, 0xFFCC9933, 0xFFCCCC33, 0xFFCCFF33, 0xFFCC0066, 0xFFCC3366, 0xFFCC6666, 0xFFCC9966,
            0xFFCCCC66, 0xFFCCFF66, 0xFFCC0099, 0xFFCC3399, 0xFFCC6699, 0xFFCC9999, 0xFFCCCC99, 0xFFCCFF99,
            0xFFCC00CC, 0xFFCC33CC, 0xFFCC66CC, 0xFFCC99CC, 0xFFCCCCCC, 0xFFCCFFCC, 0xFFCC00FF, 0xFFCC33FF, 
            0xFFCC66FF, 0xFFCC99FF, 0xFFCCCCFF, 0xFFCCFFFF, 0xFFFF0000, 0xFFFF3300, 0xFFFF6600, 0xFFFF9900, 
            0xFFFFCC00, 0xFFFFFF00, 0xFFFF0033, 0xFFFF3333, 0xFFFF6633, 0xFFFF9933, 0xFFFFCC33, 0xFFFFFF33,
            0xFFFF0066, 0xFFFF3366, 0xFFFF6666, 0xFFFF9966, 0xFFFFCC66, 0xFFFFFF66, 0xFFFF0099, 0xFFFF3399, 
            0xFFFF6699, 0xFFFF9999, 0xFFFFCC99, 0xFFFFFF99, 0xFFFF00CC, 0xFFFF33CC, 0xFFFF66CC, 0xFFFF99CC, 
            0xFFFFCCCC, 0xFFFFFFCC, 0xFFFF00FF, 0xFFFF33FF, 0xFFFF66FF, 0xFFFF99FF, 0xFFFFCCFF, 0xFFFFFFFF];
    },
},
'dispatch', {
    quickSendOther: function(rcvr, lobits) {
        // returns true if it succeeds
        this.success = true;
        switch (lobits) {
            case 0x0: return this.popNandPushIfOK(2, this.objectAt(true,true,false)); // at:
            case 0x1: return this.popNandPushIfOK(3, this.objectAtPut(true,true,false)); // at:put:
            case 0x2: return this.popNandPushIfOK(1, this.objectSize(true)); // size
            //case 0x3: return false; // next
            //case 0x4: return false; // nextPut:
            //case 0x5: return false; // atEnd
            case 0x6: return this.pop2andPushBoolIfOK(this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 0x7: return this.popNandPushIfOK(1,this.vm.getClass(this.vm.top())); // class
            case 0x8: return this.popNandPushIfOK(2,this.doBlockCopy()); // blockCopy:
            case 0x9: return this.primitiveBlockValue(0); // value
            case 0xA: return this.primitiveBlockValue(1); // value:
            //case 0xB: return false; // do:
            //case 0xC: return false; // new
            //case 0xD: return false; // new:
            //case 0xE: return false; // x
            //case 0xF: return false; // y
        }
        return false;
    },
    doPrimitive: function(index, argCount, primMethod) {
        this.success = true;
        if (index < 128) // Chrome only optimized up to 128 cases
        switch (index) {
            // Integer Primitives (0-19)
            case 1: return this.popNandPushIntIfOK(2,this.stackInteger(1) + this.stackInteger(0));  // Integer.add
            case 2: return this.popNandPushIntIfOK(2,this.stackInteger(1) - this.stackInteger(0));  // Integer.subtract
            case 3: return this.pop2andPushBoolIfOK(this.stackInteger(1) < this.stackInteger(0));   // Integer.less
            case 4: return this.pop2andPushBoolIfOK(this.stackInteger(1) > this.stackInteger(0));   // Integer.greater
            case 5: return this.pop2andPushBoolIfOK(this.stackInteger(1) <= this.stackInteger(0));  // Integer.leq
            case 6: return this.pop2andPushBoolIfOK(this.stackInteger(1) >= this.stackInteger(0));  // Integer.geq
            case 7: return this.pop2andPushBoolIfOK(this.stackInteger(1) === this.stackInteger(0)); // Integer.equal
            case 8: return this.pop2andPushBoolIfOK(this.stackInteger(1) !== this.stackInteger(0)); // Integer.notequal
            case 9: return this.popNandPushIntIfOK(2,this.stackInteger(1) * this.stackInteger(0));  // Integer.multiply *
            case 10: return this.popNandPushIntIfOK(2,this.vm.quickDivide(this.stackInteger(1),this.stackInteger(0)));  // Integer.divide /  (fails unless exact)
            case 11: return this.popNandPushIntIfOK(2,this.vm.mod(this.stackInteger(1),this.stackInteger(0)));  // Integer.mod \\
            case 12: return this.popNandPushIntIfOK(2,this.vm.div(this.stackInteger(1),this.stackInteger(0)));  // Integer.div //
            case 13: return this.popNandPushIntIfOK(2,this.stackInteger(1) / this.stackInteger(0) | 0);  // Integer.quo
            case 14: return this.popNandPushIfOK(2,this.doBitAnd());  // SmallInt.bitAnd
            case 15: return this.popNandPushIfOK(2,this.doBitOr());  // SmallInt.bitOr
            case 16: return this.popNandPushIfOK(2,this.doBitXor());  // SmallInt.bitXor
            case 17: return this.popNandPushIfOK(2,this.doBitShift());  // SmallInt.bitShift
            case 18: return this.primitiveMakePoint(argCount, false);
            case 19: return false;                                 // Guard primitive for simulation -- *must* fail
            // LargeInteger Primitives (20-39)
            // 32-bit logic is aliased to Integer prims above
            case 20: return false; // primitiveRemLargeIntegers
            case 21: return false; // primitiveAddLargeIntegers
            case 22: return false; // primitiveSubtractLargeIntegers
            case 23: return false; // primitiveLessThanLargeIntegers
            case 24: return false; // primitiveGreaterThanLargeIntegers
            case 25: return false; // primitiveLessOrEqualLargeIntegers
            case 26: return false; // primitiveGreaterOrEqualLargeIntegers
            case 27: return false; // primitiveEqualLargeIntegers
            case 28: return false; // primitiveNotEqualLargeIntegers
            case 29: return false; // primitiveMultiplyLargeIntegers
            case 30: return false; // primitiveDivideLargeIntegers
            case 31: return false; // primitiveModLargeIntegers
            case 32: return false; // primitiveDivLargeIntegers
            case 33: return false; // primitiveQuoLargeIntegers
            case 34: return false; // primitiveBitAndLargeIntegers
            case 35: return false; // primitiveBitOrLargeIntegers
            case 36: return false; // primitiveBitXorLargeIntegers
            case 37: return false; // primitiveBitShiftLargeIntegers
            case 38: return this.popNandPushIfOK(2, this.objectAt(false,false,false)); // Float basicAt
            case 39: return this.popNandPushIfOK(3, this.objectAtPut(false,false,false)); // Float basicAtPut
            // Float Primitives (40-59)
            case 40: return this.popNandPushFloatIfOK(1,this.stackInteger(0)); // primitiveAsFloat
            case 41: return this.popNandPushFloatIfOK(2,this.stackFloat(1)+this.stackFloat(0));  // Float +
            case 42: return this.popNandPushFloatIfOK(2,this.stackFloat(1)-this.stackFloat(0));  // Float -	
            case 43: return this.pop2andPushBoolIfOK(this.stackFloat(1)<this.stackFloat(0));  // Float <
            case 44: return this.pop2andPushBoolIfOK(this.stackFloat(1)>this.stackFloat(0));  // Float >
            case 45: return this.pop2andPushBoolIfOK(this.stackFloat(1)<=this.stackFloat(0));  // Float <=
            case 46: return this.pop2andPushBoolIfOK(this.stackFloat(1)>=this.stackFloat(0));  // Float >=
            case 47: return this.pop2andPushBoolIfOK(this.stackFloat(1)===this.stackFloat(0));  // Float =
            case 48: return this.pop2andPushBoolIfOK(this.stackFloat(1)!==this.stackFloat(0));  // Float !=
            case 49: return this.popNandPushFloatIfOK(2,this.stackFloat(1)*this.stackFloat(0));  // Float.mul
            case 50: return this.popNandPushFloatIfOK(2,this.safeFDiv(this.stackFloat(1),this.stackFloat(0)));  // Float.div
            case 51: return this.popNandPushIfOK(1,this.floatAsSmallInt(this.stackFloat(0)));  // Float.asInteger
            case 52: return false; // Float.fractionPart (modf)
            case 53: return this.popNandPushIntIfOK(1, this.frexp_exponent(this.stackFloat(0)) - 1); // Float.exponent
            case 54: return this.popNandPushFloatIfOK(2, this.ldexp(this.stackFloat(1), this.stackFloat(0))); // Float.timesTwoPower
            case 55: return this.popNandPushFloatIfOK(1, Math.sqrt(this.stackFloat(0))); // SquareRoot
            case 56: return this.popNandPushFloatIfOK(1, Math.sin(this.stackFloat(0))); // Sine
            case 57: return this.popNandPushFloatIfOK(1, Math.atan(this.stackFloat(0))); // Arctan
            case 58: return this.popNandPushFloatIfOK(1, Math.log(this.stackFloat(0))); // LogN
            case 59: return this.popNandPushFloatIfOK(1, Math.exp(this.stackFloat(0))); // Exp
            // Subscript and Stream Primitives (60-67)
            case 60: return this.popNandPushIfOK(2, this.objectAt(false,false,false)); // basicAt:
            case 61: return this.popNandPushIfOK(3, this.objectAtPut(false,false,false)); // basicAt:put:
            case 62: return this.popNandPushIfOK(1, this.objectSize(false)); // size
            case 63: return this.popNandPushIfOK(2, this.objectAt(false,true,false)); // String.basicAt:
            case 64: return this.popNandPushIfOK(3, this.objectAtPut(false,true,false)); // String.basicAt:put:
            case 65: return false; // primitiveNext
            case 66: return false; // primitiveNextPut
            case 67: return false; // primitiveAtEnd
            // StorageManagement Primitives (68-79)
            case 68: return this.popNandPushIfOK(2, this.objectAt(false,false,true)); // Method.objectAt:
            case 69: return this.popNandPushIfOK(3, this.objectAtPut(false,false,true)); // Method.objectAt:put:
            case 70: return this.popNandPushIfOK(1, this.instantiateClass(this.stackNonInteger(0), 0)); // Class.new
            case 71: return this.popNandPushIfOK(2, this.instantiateClass(this.stackNonInteger(1), this.stackPos32BitInt(0))); // Class.new:
            case 72: return this.primitiveArrayBecome(argCount, false); // one way
            case 73: return this.popNandPushIfOK(2, this.objectAt(false,false,true)); // instVarAt:
            case 74: return this.popNandPushIfOK(3, this.objectAtPut(false,false,true)); // instVarAt:put:
            case 75: return this.popNandPushIfOK(1, this.stackNonInteger(0).hash); // Object.identityHash
            case 76: return this.primitiveStoreStackp(argCount);  // (Blue Book: primitiveAsObject)
            case 77: return this.popNandPushIfOK(1, this.someInstanceOf(this.stackNonInteger(0))); // Class.someInstance
            case 78: return this.popNandPushIfOK(1, this.nextInstanceAfter(this.stackNonInteger(0))); // Object.nextInstance
            case 79: return this.primitiveNewMethod(argCount); // Compiledmethod.new
            // Control Primitives (80-89)
            case 80: return this.popNandPushIfOK(2,this.doBlockCopy()); // blockCopy:
            case 81: return this.primitiveBlockValue(argCount); // BlockContext.value
            case 82: return this.primitiveBlockValueWithArgs(argCount); // BlockContext.valueWithArguments:
            case 83: return this.vm.primitivePerform(argCount); // Object.perform:(with:)*
            case 84: return this.vm.primitivePerformWithArgs(argCount, false); //  Object.perform:withArguments:
            case 85: return this.primitiveSignal(); // Semaphore.wait
            case 86: return this.primitiveWait(); // Semaphore.wait
            case 87: return this.primitiveResume(); // Process.resume
            case 88: return this.primitiveSuspend(); // Process.suspend
            case 89: return this.vm.flushMethodCache(); //primitiveFlushCache
            // Input/Output Primitives (90-109)
            case 90: return this.primitiveMousePoint(argCount); // mousePoint
            case 91: return this.primitiveTestDisplayDepth(argCount); // cursorLocPut in old images
            // case 92: return false; // primitiveSetDisplayMode
            case 93: return this.primitiveInputSemaphore(argCount); 
            case 94: return this.primitiveGetNextEvent(argCount);
            case 95: return this.primitiveInputWord(argCount);
            case 96: return this.namedPrimitive('BitBltPlugin', 'primitiveCopyBits', argCount);
            case 97: return this.primitiveSnapshot(argCount);
            //case 98: return false; // primitiveStoreImageSegment
            case 99: return this.primitiveLoadImageSegment(argCount);
            case 100: return this.vm.primitivePerformWithArgs(argCount, true); // Object.perform:withArguments:inSuperclass: (Blue Book: primitiveSignalAtTick)
            case 101: return this.primitiveBeCursor(argCount); // Cursor.beCursor
            case 102: return this.primitiveBeDisplay(argCount); // DisplayScreen.beDisplay
            case 103: return false; // primitiveScanCharacters
            case 104: return false; // primitiveDrawLoop
            case 105: return this.popNandPushIfOK(5, this.doStringReplace()); // string and array replace
            case 106: return this.primitiveScreenSize(argCount); // actualScreenSize
            case 107: return this.primitiveMouseButtons(argCount); // Sensor mouseButtons
            case 108: return this.primitiveKeyboardNext(argCount); // Sensor kbdNext
            case 109: return this.primitiveKeyboardPeek(argCount); // Sensor kbdPeek
            // System Primitives (110-119)
            case 110: return this.pop2andPushBoolIfOK(this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 111: return this.popNandPushIfOK(1, this.vm.getClass(this.vm.top())); // Object.class
            case 112: return this.popNandPushIfOK(1, this.vm.image.bytesLeft()); //primitiveBytesLeft
            case 113: return this.primitiveQuit(argCount);
            case 114: return this.primitiveExitToDebugger(argCount);
            case 115: return this.primitiveChangeClass(argCount);
            case 116: return this.vm.flushMethodCacheForMethod(this.vm.top());  // after Squeak 2.2 uses 119
            case 117: return this.doNamedPrimitive(argCount, primMethod); // named prims
            case 118: return this.primitiveDoPrimitiveWithArgs(argCount);
            case 119: return this.vm.flushMethodCacheForSelector(this.vm.top()); // before Squeak 2.3 uses 116
            // Miscellaneous Primitives (120-149)
            case 120: return false; //primitiveCalloutToFFI
            case 121: return this.primitiveImageName(argCount); //get+set imageName
            case 122: return this.primitiveReverseDisplay(argCount); // Blue Book: primitiveImageVolume
            //case 123: return false; //TODO primitiveValueUninterruptably
            case 124: return this.popNandPushIfOK(2, this.registerSemaphore(Squeak.splOb_TheLowSpaceSemaphore));
            case 125: return this.popNandPushIfOK(2, this.setLowSpaceThreshold());
            case 126: return this.primitiveDeferDisplayUpdates(argCount);
    		case 127: return this.primitiveShowDisplayRect(argCount);
    	} else if (index < 256) switch (index) { // Chrome only optimized up to 128 cases
            case 128: return this.primitiveArrayBecome(argCount, true); // both ways
            case 129: return this.popNandPushIfOK(1, this.vm.image.specialObjectsArray); //specialObjectsOop
            case 130: return this.primitiveFullGC(argCount);
            case 131: return this.popNandPushIfOK(1, this.vm.image.partialGC()); // GCmost
            case 132: return this.pop2andPushBoolIfOK(this.pointsTo(this.stackNonInteger(1), this.vm.top())); //Object.pointsTo
            case 133: return true; //TODO primitiveSetInterruptKey
            case 134: return this.popNandPushIfOK(2, this.registerSemaphore(Squeak.splOb_TheInterruptSemaphore));
            case 135: return this.popNandPushIfOK(1, this.millisecondClockValue());
            case 136: return this.primitiveSignalAtMilliseconds(argCount); //Delay signal:atMs:());
            case 137: return this.popNandPushIfOK(1, this.secondClock()); // seconds since Jan 1, 1901
            case 138: return this.popNandPushIfOK(1, this.someObject()); // Object.someObject
            case 139: return this.popNandPushIfOK(1, this.nextObject(this.vm.top())); // Object.nextObject
            case 140: return this.primitiveBeep(argCount);
            case 141: return this.primitiveClipboardText(argCount);
            case 142: return this.popNandPushIfOK(1, this.makeStString(this.filenameToSqueak(Squeak.vmPath)));
            case 143: // short at and shortAtPut
            case 144: return this.primitiveShortAtAndPut(argCount);
            case 145: return this.primitiveConstantFill(argCount);
            case 146: return this.namedPrimitive('JoystickTabletPlugin', 'primitiveReadJoystick', argCount);
            case 147: return this.namedPrimitive('BitBltPlugin', 'primitiveWarpBits', argCount);
            case 148: return this.popNandPushIfOK(1, this.vm.image.clone(this.vm.top())); //shallowCopy
            case 149: return this.primitiveGetAttribute(argCount);
            // File Primitives (150-169)
            case 150: if (this.oldPrims) return this.primitiveFileAtEnd(argCount);
            case 151: if (this.oldPrims) return this.primitiveFileClose(argCount);
            case 152: if (this.oldPrims) return this.primitiveFileGetPosition(argCount);
            case 153: if (this.oldPrims) return this.primitiveFileOpen(argCount);
            case 154: if (this.oldPrims) return this.primitiveFileRead(argCount);
            case 155: if (this.oldPrims) return this.primitiveFileSetPosition(argCount);
            case 156: if (this.oldPrims) return this.primitiveFileDelete(argCount);
            case 157: if (this.oldPrims) return this.primitiveFileSize(argCount);
            case 158: if (this.oldPrims) return this.primitiveFileWrite(argCount);
            case 159: if (this.oldPrims) return this.primitiveFileRename(argCount);
            case 160: if (this.oldPrims) return this.primitiveDirectoryCreate(argCount); // new: primitiveAdoptInstance
            case 161: if (this.oldPrims) return this.primitiveDirectoryDelimitor(argCount); // new: primitiveSetIdentityHash
            case 162: if (this.oldPrims) return this.primitiveDirectoryLookup(argCount);
            case 163: if (this.oldPrims) return this.primitiveDirectoryDelete(argCount);
            // 164: unused
            case 165:
            case 166: return this.primitiveIntegerAtAndPut(argCount);
            case 167: return false; // Processor.yield
            case 168: return this.primitiveCopyObject(argCount); 
            case 169: if (this.oldPrims) return this.primitiveDirectorySetMacTypeAndCreator(argCount);
                else return this.primitiveNotIdentical(argCount);
            // Sound Primitives (170-199)
            case 170: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStart', argCount);
            case 171: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartWithSemaphore', argCount);
            case 172: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStop', argCount);
            case 173: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundAvailableSpace', argCount);
            case 174: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySamples', argCount);
            case 175: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySilence', argCount);
            case 176: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primWaveTableSoundmixSampleCountintostartingAtpan', argCount);
            case 177: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primFMSoundmixSampleCountintostartingAtpan', argCount);
            case 178: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primPluckedSoundmixSampleCountintostartingAtpan', argCount);
            case 179: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primSampledSoundmixSampleCountintostartingAtpan', argCount);
            case 180: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixFMSound', argCount);
            case 181: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixPluckedSound', argCount);
            case 182: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'oldprimSampledSoundmixSampleCountintostartingAtleftVolrightVol', argCount);
            case 183: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveApplyReverb', argCount);
            case 184: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixLoopedSampledSound', argCount);
            case 185: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixSampledSound', argCount);
            // 186-188: was unused
            case 188: if (!this.oldPrims) return this.primitiveExecuteMethodArgsArray(argCount);
            case 189: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundInsertSamples', argCount);
            case 190: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartRecording', argCount);
            case 191: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStopRecording', argCount);
            case 192: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundGetRecordingSampleRate', argCount);
            case 193: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundRecordSamples', argCount);
            case 194: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundSetRecordLevel', argCount);
            case 195: return false; // Context.findNextUnwindContextUpTo:
            case 196: return false; // Context.terminateTo:
            case 197: return false; // Context.findNextHandlerContextStarting
            case 198: return false; // MarkUnwindMethod (must fail)
            case 199: return false; // MarkHandlerMethod (must fail)
            // Networking Primitives (200-229)
            case 200: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveInitializeNetwork', argCount);
                else return this.primitiveClosureCopyWithCopiedValues(argCount);
            case 201: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartNameLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 202: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverNameLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 203: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartAddressLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 204: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAddressLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 205: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAbortLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 206: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverLocalAddress', argCount);
                else return  this.primitiveClosureValueWithArgs(argCount);
            case 207: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStatus', argCount);
            case 208: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverError', argCount);
            case 209: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCreate', argCount);
            case 210: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketDestroy', argCount);
                else return this.popNandPushIfOK(2, this.objectAt(false,false,false)); // contextAt:
            case 211: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectionStatus', argCount);
                else return this.popNandPushIfOK(3, this.objectAtPut(false,false,false)); // contextAt:put:
            case 212: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketError', argCount);
            case 213: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalAddress', argCount);
            case 214: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalPort', argCount);
            case 215: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemoteAddress', argCount);
            case 216: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemotePort', argCount);
            case 217: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectToPort', argCount);
            case 218: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketListenOnPort', argCount);
            case 219: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCloseConnection', argCount);
            case 220: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketAbortConnection', argCount);
            case 221: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataBufCount', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 222: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataAvailable', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 223: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDataBufCount', argCount);
            case 224: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDone', argCount);
            // 225-229: unused
            // Other Primitives (230-249)
            case 230: return this.primitiveRelinquishProcessorForMicroseconds(argCount);
            case 231: return this.primitiveForceDisplayUpdate(argCount);
            // case 232:  return this.primitiveFormPrint(argCount);
            case 233: return this.primitiveSetFullScreen(argCount);
            case 234: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveDecompressFromByteArray', argCount);
            case 235: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompareString', argCount);
            case 236: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveConvert8BitSigned', argCount);
            case 237: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompressToByteArray', argCount);
            case 238: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortOpen', argCount);
            case 239: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortClose', argCount);
            case 240: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortWrite', argCount);
                else return this.popNandPushIfOK(1, this.microsecondClockUTC());
            case 241: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortRead', argCount);
                else return this.popNandPushIfOK(1, this.microsecondClockLocal());
            // 242: unused
            case 243: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveTranslateStringWithTable', argCount);
            case 244: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindFirstInString' , argCount);
            case 245: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveIndexOfAsciiInString', argCount);
            case 246: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindSubstring', argCount);
            // 247: unused
            case 248: return this.vm.primitiveInvokeObjectAsMethod(argCount, primMethod); // see findSelectorInClass()
            case 249: return this.primitiveArrayBecome(argCount, false); // one way, opt. copy hash
            case 254: return this.primitiveVMParameter(argCount);
    	} else switch (index) { // Chrome only optimized up to 128 cases
            //MIDI Primitives (520-539)
            case 521: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIClosePort', argCount);
            case 522: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetClock', argCount);
            case 523: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortCount', argCount);
            case 524: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortDirectionality', argCount);
            case 525: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortName', argCount);
            case 526: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIOpenPort', argCount);
            case 527: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIParameterGetOrSet', argCount);
            case 528: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIRead', argCount);
            case 529: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIWrite', argCount);
            // 530-539: reserved for extended MIDI primitives     
            // Sound Codec Primitives
            case 550: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeMono', argCount);
            case 551: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeStereo', argCount);
            case 552: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeMono', argCount);
            case 553: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeStereo', argCount);
            // External primitive support primitives (570-574)
            // case 570: return this.primitiveFlushExternalPrimitives(argCount);
            case 571: return this.primitiveUnloadModule(argCount);
            case 572: return this.primitiveListBuiltinModule(argCount);
            case 573: return this.primitiveListLoadedModule(argCount);
        }
        console.error("primitive " + index + " not implemented yet");
        return false;
    },
    namedPrimitive: function(modName, functionName, argCount) {
        var mod = modName === "" ? this : this.loadedModules[modName];
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
        }
        var result = false;
        if (mod) {
            this.interpreterProxy.argCount = argCount;
            var primitive = mod[functionName];
            if (typeof primitive === "function") {
                result = mod[functionName](argCount);
            } else if (typeof primitive === "string") {
                // allow late binding for built-ins
                result = this[primitive](argCount);
            } else {
                this.vm.warnOnce("missing primitive: " + modName + "." + functionName);
            }
        } else {
            this.vm.warnOnce("missing module: " + modName + " (" + functionName + ")");
        }
        if (result === true || result === false) return result;
        return this.success;
    },
    doNamedPrimitive: function(argCount, primMethod) {
        if (primMethod.pointersSize() < 2) return false;
        var firstLiteral = primMethod.pointers[1]; // skip method header
        if (firstLiteral.pointersSize() !== 4) return false;
        this.primMethod = primMethod;
        var moduleName = firstLiteral.pointers[0].bytesAsString();
        var functionName = firstLiteral.pointers[1].bytesAsString();
        return this.namedPrimitive(moduleName, functionName, argCount);
    },
    fakePrimitive: function(prim, retVal, argCount) {
        // fake a named primitive
        // prim and retVal need to be curried when used:
        //  this.fakePrimitive.bind(this, "Module.primitive", 42)
        this.vm.warnOnce("faking primitive: " + prim);
        if (retVal === undefined) this.vm.popN(argCount);
        else this.vm.popNandPush(argCount+1, this.makeStObject(retVal));
        return true;
    },
},
'modules', {
    loadModule: function(modName) {
        var mod = Squeak.externalModules[modName] || this.builtinModules[modName];
        if (!mod) return null;
        if (this.patchModules[modName])
            this.patchModule(mod, modName);
        if (mod.setInterpreter) {
            if (!mod.setInterpreter(this.interpreterProxy)) {
                console.log("Wrong interpreter proxy version: " + modName);
                return null;
            }
        }
        var initFunc = mod.initialiseModule;
        if (typeof initFunc === 'function') {
            mod.initialiseModule();
        } else if (typeof initFunc === 'string') {
            // allow late binding for built-ins
            this[initFunc]();
        }
        if (this.interpreterProxy.failed()) {
            console.log("Module initialization failed: " + modName);
            return null;
        }
        console.log("Loaded module: " + modName);
        return mod;
    },
    patchModule: function(mod, modName) {
        var patch = this.patchModules[modName];
        for (var key in patch)
            mod[key] = patch[key];
    },
    unloadModule: function(modName) {
        var mod = this.loadedModules[modName];
        if (!modName || !mod|| mod === this) return null;
        delete this.loadedModules[modName];
        var unloadFunc = mod.unloadModule;
        if (typeof unloadFunc === 'function') {
            mod.unloadModule(this);
        } else if (typeof unloadFunc === 'string') {
            // allow late binding for built-ins
            this[unloadFunc](this);
        }
        console.log("Unloaded module: " + modName);
        return mod;
    },
    primitiveUnloadModule: function(argCount) {
        var	moduleName = this.stackNonInteger(0).bytesAsString();
        if (!moduleName) return false;
        this.unloadModule(moduleName);
    	return this.popNIfOK(argCount);
	},
    primitiveListBuiltinModule: function(argCount) {
        var	index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = Object.keys(this.builtinModules);
    	return this.popNandPushIfOK(argCount + 1, this.makeStObject(moduleNames[index]));
    },
    primitiveListLoadedModule: function(argCount) {
        var	index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = [];
        for (var key in this.loadedModules) {
            var module = this.loadedModules[key];
            if (module) {
                var moduleName = module.getModuleName ? module.getModuleName() : key;
                moduleNames.push(moduleName);
            }
        }
    	return this.popNandPushIfOK(argCount + 1, this.makeStObject(moduleNames[index]));
    },
},
'stack access', {
    popNIfOK: function(nToPop) {
        if (!this.success) return false;
        this.vm.popN(nToPop);
        return true;
    },
    pop2andPushBoolIfOK: function(bool) {
        this.vm.success = this.success;
        return this.vm.pop2AndPushBoolResult(bool);
    },
    popNandPushIfOK: function(nToPop, returnValue) {
        if (!this.success || returnValue == null) return false;
        this.vm.popNandPush(nToPop, returnValue);
        return true;
    },
    popNandPushIntIfOK: function(nToPop, returnValue) {
        if (!this.success || !this.vm.canBeSmallInt(returnValue)) return false; 
        return this.popNandPushIfOK(nToPop, returnValue);
    },
    popNandPushFloatIfOK: function(nToPop, returnValue) {
        if (!this.success) return false;
        return this.popNandPushIfOK(nToPop, this.makeFloat(returnValue));
    },
    stackNonInteger: function(nDeep) {
        return this.checkNonInteger(this.vm.stackValue(nDeep));
    },
    stackInteger: function(nDeep) {
        return this.checkSmallInt(this.vm.stackValue(nDeep));
    },
    stackPos32BitInt: function(nDeep) {
        return this.positive32BitValueOf(this.vm.stackValue(nDeep));
    },
    pos32BitIntFor: function(signed32) {
        // Return the 32-bit quantity as an unsigned 32-bit integer
        if (signed32 >= 0 && signed32 <= Squeak.MaxSmallInt) return signed32;
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (signed32>>>(8*i)) & 255;
        return lgIntObj;
    },
    pos64BitIntFor: function(longlong) {
        // Return the quantity as an unsigned 64-bit integer
        if (longlong <= 0xFFFFFFFF) return this.pos32BitIntFor(longlong);
        var sz = longlong <= 0xFFFFFFFFFF ? 5 :
                 longlong <= 0xFFFFFFFFFFFF ? 6 :
                 longlong <= 0xFFFFFFFFFFFFFF ? 7 : 8;
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, sz),
            bytes = lgIntObj.bytes;
        for (var i = 0; i < sz; i++) {
            bytes[i] = longlong & 255;
            longlong /= 256;
        }
        return lgIntObj;
    },
    stackSigned32BitInt: function(nDeep) {
        var stackVal = this.vm.stackValue(nDeep);
        if (typeof stackVal === "number") {   // SmallInteger
            return stackVal;
        }
        if (stackVal.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = stackVal.bytes,
            value = 0;
        for (var i=0; i<4; i++)
            value += (bytes[i]&255) * (1 << 8*i);
        if (this.isA(stackVal, Squeak.splOb_ClassLargePositiveInteger)) 
            return value;
        if (this.isA(stackVal, Squeak.splOb_ClassLargeNegativeInteger)) 
            return -value;
        this.success = false;
        return 0;
    },
    signed32BitIntegerFor: function(signed32) {
        // Return the 32-bit quantity as a signed 32-bit integer
        if (signed32 >= Squeak.MinSmallInt && signed32 <= Squeak.MaxSmallInt) return signed32;
        var negative = signed32 < 0,
            unsigned = negative ? -signed32 : signed32,
            lgIntClass = negative ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger,
            lgIntObj = this.vm.instantiateClass(this.vm.specialObjects[lgIntClass], 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (unsigned>>>(8*i)) & 255;
        return lgIntObj;
    },
    stackFloat: function(nDeep) {
        return this.checkFloat(this.vm.stackValue(nDeep));
    },
    stackBoolean: function(nDeep) {
        return this.checkBoolean(this.vm.stackValue(nDeep));
    },
},
'numbers', {
    doBitAnd: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr & arg);
    },
    doBitOr: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr | arg);
    },
    doBitXor: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr ^ arg);
    },
    doBitShift: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackInteger(0);
        if (!this.success) return 0;
        var result = this.vm.safeShift(rcvr, arg); // returns negative result if failed
        if (result > 0)
            return this.pos32BitIntFor(this.vm.safeShift(rcvr, arg));
        this.success = false;
        return 0;
    },
    safeFDiv: function(dividend, divisor) {
        if (divisor === 0.0) {
            this.success = false;
            return 1.0;
        }
        return dividend / divisor;
    },
    floatAsSmallInt: function(float) {
        var truncated = float >= 0 ? Math.floor(float) : Math.ceil(float);
        return this.ensureSmallInt(truncated);
    },
    frexp_exponent: function(value) {
        // frexp separates a float into its mantissa and exponent
        if (value == 0.0) return 0;     // zero is special
        var data = new DataView(new ArrayBuffer(8));
        data.setFloat64(0, value);      // for accessing IEEE-754 exponent bits
        var bits = (data.getUint32(0) >>> 20) & 0x7FF;
        if (bits === 0) { // we have a subnormal float (actual zero was handled above)
            // make it normal by multiplying a large number
            data.setFloat64(0, value * Math.pow(2, 64));
            // access its exponent bits, and subtract the large number's exponent
            bits = ((data.getUint32(0) >>> 20) & 0x7FF) - 64;
        }
        var exponent = bits - 1022;                 // apply bias
        // mantissa = this.ldexp(value, -exponent)  // not needed for Squeak
        return exponent;
    },
    ldexp: function(mantissa, exponent) {
        // construct a float from mantissa and exponent
        return exponent > 1023 // avoid multiplying by infinity
            ? mantissa * Math.pow(2, 1023) * Math.pow(2, exponent - 1023)
            : exponent < -1074 // avoid multiplying by zero
            ? mantissa * Math.pow(2, -1074) * Math.pow(2, exponent + 1074)
            : mantissa * Math.pow(2, exponent);
    },
},
'utils', {
    floatOrInt: function(obj) {
        if (obj.isFloat) return obj.float;
        if (typeof obj === "number") return obj;  // SmallInteger
        return 0;
    },
    positive32BitValueOf: function(obj) {
        if (typeof obj === "number") { // SmallInteger
            if (obj >= 0)
                return obj;
            this.success = false;
            return 0;
        }
        if (!this.isA(obj, Squeak.splOb_ClassLargePositiveInteger) || obj.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = obj.bytes;
        var value = 0;
        for (var i=0; i<4; i++)
            value += (bytes[i]&255) * (1 << 8*i);
        return value;
    },
    checkFloat: function(maybeFloat) { // returns a number and sets success
        if (maybeFloat.isFloat)
            return maybeFloat.float;
        if (typeof maybeFloat === "number")  // SmallInteger
            return maybeFloat;
        this.success = false;
        return 0.0;
    },
    checkSmallInt: function(maybeSmall) { // returns an int and sets success
        if (typeof maybeSmall === "number")
            return maybeSmall;
        this.success = false;
        return 0;
    },
    checkNonInteger: function(obj) { // returns a SqObj and sets success
        if (typeof obj !== "number")
            return obj;
        this.success = false;
        return this.vm.nilObj;
    },
    checkBoolean: function(obj) { // returns true/false and sets success
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        return this.success = false;
    },
    indexableSize: function(obj) {
        if (typeof obj === "number") return -1; // -1 means not indexable
        var fmt = obj.format;
        if (fmt<2) return -1; //not indexable
        if (fmt===3 && this.vm.isContext(obj) && !this.allowAccessBeyondSP)
            return obj.pointers[Squeak.Context_stackPointer]; // no access beyond top of stacks
        if (fmt<6) return obj.pointersSize() - obj.instSize(); // pointers
        if (fmt<8) return obj.wordsSize(); // words
        if (fmt<12) return obj.bytesSize(); // bytes
        return obj.bytesSize() + (4 * obj.pointersSize()); // methods
    },
    isA: function(obj, knownClass) {
        return obj.sqClass === this.vm.specialObjects[knownClass];
    },
    isKindOf: function(obj, knownClass) {
        var classOrSuper = obj.sqClass;
        var theClass = this.vm.specialObjects[knownClass];
        while (!classOrSuper.isNil) {
            if (classOrSuper === theClass) return true;
            classOrSuper = classOrSuper.pointers[Squeak.Class_superclass];
        }
        return false;
    },
    ensureSmallInt: function(number) {
        if (number === (number|0) && this.vm.canBeSmallInt(number))
            return number;
        this.success = false;
        return 0;
    },
    charFromInt: function(ascii) {
        var charTable = this.vm.specialObjects[Squeak.splOb_CharacterTable];
        return charTable.pointers[ascii];
    },
    makeFloat: function(value) {
        var floatClass = this.vm.specialObjects[Squeak.splOb_ClassFloat];
        var newFloat = this.vm.instantiateClass(floatClass, 2);
        newFloat.float = value;
        return newFloat;
	},
    makeLargeIfNeeded: function(integer) {
        return this.vm.canBeSmallInt(integer) ? integer : this.makeLargeInt(integer);
    },
    makeLargeInt: function(integer) {
        if (integer < 0) throw Error("negative large ints not implemented yet");
        if (integer > 0xFFFFFFFF) throw Error("large large ints not implemented yet");
        return this.pos32BitIntFor(integer);
    },
    makePointWithXandY: function(x, y) {
        var pointClass = this.vm.specialObjects[Squeak.splOb_ClassPoint];
        var newPoint = this.vm.instantiateClass(pointClass, 0);
        newPoint.pointers[Squeak.Point_x] = x;
        newPoint.pointers[Squeak.Point_y] = y;
        return newPoint;
    },
    makeStArray: function(jsArray) {
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], jsArray.length);
        for (var i = 0; i < jsArray.length; i++)
            array.pointers[i] = this.makeStObject(jsArray[i]);
        return array;
    },
    makeStString: function(jsString) {
        var bytes = [];
        for (var i = 0; i < jsString.length; ++i)
            bytes.push(jsString.charCodeAt(i) & 0xFF);
        var stString = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassString], bytes.length);
        stString.bytes = bytes;
        return stString;
    },
    makeStObject: function(obj) {
        if (obj === undefined || obj === null) return this.vm.nilObj;
        if (obj === true) return this.vm.trueObj;
        if (obj === false) return this.vm.falseObj;
        if (obj.stClass) return obj;
        if (typeof obj === "string" || obj.constructor === Uint8Array) return this.makeStString(obj);
        if (obj.constructor === Array) return this.makeStArray(obj);
        if (typeof obj === "number")
            if (obj === (obj|0)) return this.makeLargeIfNeeded(obj);
            else return this.makeFloat(obj)
        throw Error("cannot make smalltalk object");
    },
    pointsTo: function(rcvr, arg) {
        if (!rcvr.pointers) return false;
        return rcvr.pointers.indexOf(arg) >= 0;
    },
    asUint8Array: function(buffer) {
        if (buffer.constructor === Uint8Array) return buffer;
        if (buffer.constructor === ArrayBuffer) return new Uint8Array(buffer);
        if (typeof buffer === "string") {
            var array = new Uint8Array(buffer.length);
            for (var i = 0; i < buffer.length; i++)
                array[i] = buffer.charCodeAt(i);
            return array;
        }
        throw Error("unknown buffer type");
    },
    filenameToSqueak: function(unixpath) {
        var slash = unixpath[0] !== "/" ? "/" : "",
            filepath = "/SqueakJS" + slash + unixpath;                      // add SqueakJS
        if (this.emulateMac) 
            filepath = ("Macintosh HD" + filepath)                          // add Mac volume
                .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        return filepath;
    },
    filenameFromSqueak: function(filepath) {
        var unixpath = !this.emulateMac ? filepath :
            filepath.replace(/^[^:]*:/, ":")                            // remove volume
            .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        unixpath = unixpath.replace(/^\/*SqueakJS\/?/, "/");            // strip SqueakJS
        return unixpath;
    },
},
'indexing', {
    objectAt: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at: or sets success false
        var array = this.stackNonInteger(1);
        var index = this.stackPos32BitInt(0); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var floatData = array.floatData();
                if (index==1) return this.pos32BitIntFor(floatData.getUint32(0, false));
                if (index==2) return this.pos32BitIntFor(floatData.getUint32(4, false));
                this.success = false; return array;
            }
            info = this.makeAtCacheInfo(this.atCache, this.vm.specialSelectors[32], array, convertChars, includeInstVars);
        }
        if (index < 1 || index > info.size) {this.success = false; return array;}
        if (includeInstVars)  //pointers...   instVarAt and objectAt
            return array.pointers[index-1];
        if (array.format<6)   //pointers...   normal at:
            return array.pointers[index-1+info.ivarOffset];
        if (array.format<8) // words...
            return this.pos32BitIntFor(array.words[index-1]);
        if (array.format<12) // bytes...
            if (info.convertChars) return this.charFromInt(array.bytes[index-1] & 0xFF);
            else return array.bytes[index-1] & 0xFF;
        // methods (format>=12) must simulate Squeak's method indexing
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //reading lits as bytes
        return array.bytes[index-1-offset] & 0xFF;
    },
    objectAtPut: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at:put: or sets success false
        var array = this.stackNonInteger(2);
        var index = this.stackPos32BitInt(1); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atPutCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var wordToPut = this.stackPos32BitInt(0);
                if (this.success && (index == 1 || index == 2)) {
                    var floatData = array.floatData();
                    floatData.setUint32(index == 1 ? 0 : 4, wordToPut, false);
                    array.float = floatData.getFloat64(0);
                } else this.success = false;
                return this.vm.stackValue(0);
            }
            info = this.makeAtCacheInfo(this.atPutCache, this.vm.specialSelectors[34], array, convertChars, includeInstVars);
        }
        if (index<1 || index>info.size) {this.success = false; return array;}
        var objToPut = this.vm.stackValue(0);
        if (includeInstVars)  // pointers...   instVarAtPut and objectAtPut
            return array.pointers[index-1] = objToPut; //eg, objectAt:
        if (array.format<6)  // pointers...   normal atPut
            return array.pointers[index-1+info.ivarOffset] = objToPut;
        var intToPut;
        if (array.format<8) {  // words...
            intToPut = this.stackPos32BitInt(0);
            if (this.success) array.words[index-1] = intToPut;
            return objToPut;
        }
        // bytes...
        if (convertChars) {
            // put a character...
            if (objToPut.sqClass !== this.vm.specialObjects[Squeak.splOb_ClassCharacter])
                {this.success = false; return objToPut;}
            intToPut = objToPut.pointers[0];
            if (typeof intToPut !== "number") {this.success = false; return objToPut;}
        } else { // put a byte...
            if (typeof objToPut !== "number") {this.success = false; return objToPut;}
            intToPut = objToPut;
        }
        if (intToPut<0 || intToPut>255) {this.success = false; return objToPut;}
        if (array.format<8)  // bytes...
            return array.bytes[index-1] = intToPut;
        // methods (format>=12) must simulate Squeak's method indexing
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //writing lits as bytes
        array.bytes[index-1-offset] = intToPut;
        return objToPut;
    },
    objectSize: function(cameFromBytecode) {
        var rcvr = this.vm.stackValue(0),
            size = -1;
        if (cameFromBytecode) {
            // must only handle classes with size == basicSize, fail otherwise
            if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray]) {
                size = rcvr.pointersSize();
            } else if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassString]) {
                size = rcvr.bytesSize();
            }
        } else { // basicSize
            size = this.indexableSize(rcvr);
        }
        if (size === -1) {this.success = false; return -1}; //not indexable
        return this.pos32BitIntFor(size);
    },
    initAtCache: function() {
        // The purpose of the at-cache is to allow fast (bytecode) access to at/atput code
        // without having to check whether this object has overridden at, etc.
        this.atCacheSize = 32; // must be power of 2
        this.atCacheMask = this.atCacheSize - 1; //...so this is a mask
        this.atCache = [];
        this.atPutCache = [];
        this.nonCachedInfo = {};
        for (var i= 0; i < this.atCacheSize; i++) {
            this.atCache.push({});
            this.atPutCache.push({});
        }
    },
    clearAtCache: function() { //clear at-cache pointers (prior to GC)
        this.nonCachedInfo.array = null;
        for (var i= 0; i < this.atCacheSize; i++) {
            this.atCache[i].array = null;
            this.atPutCache[i].array = null;
        }
    },
    makeAtCacheInfo: function(atOrPutCache, atOrPutSelector, array, convertChars, includeInstVars) {
        //Make up an info object and store it in the atCache or the atPutCache.
        //If it's not cacheable (not a non-super send of at: or at:put:)
        //then return the info in nonCachedInfo.
        //Note that info for objectAt (includeInstVars) will have
        //a zero ivarOffset, and a size that includes the extra instVars
        var info;
        var cacheable =
            (this.vm.verifyAtSelector === atOrPutSelector)         //is at or atPut
            && (this.vm.verifyAtClass === array.sqClass)           //not a super send
            && !(array.format === 3 && this.vm.isContext(array));  //not a context (size can change)
        info = cacheable ? atOrPutCache[array.hash & this.atCacheMask] : this.nonCachedInfo;
        info.array = array;
        info.convertChars = convertChars;
        if (includeInstVars) {
            info.size = array.instSize() + Math.max(0, this.indexableSize(array));
            info.ivarOffset = 0;
        } else {
            info.size = this.indexableSize(array);
            info.ivarOffset = (array.format < 6) ? array.instSize() : 0;
        }
        return info;
    },
},
'basic',{
    instantiateClass: function(clsObj, indexableSize) {
        if (indexableSize * 4 > this.vm.image.bytesLeft()) {
            // we're not really out of memory, we have no idea how much memory is available
            // but we need to stop runaway allocations
            console.warn("squeak: out of memory");
            this.success = false;
            return null;
        } else {
            return this.vm.instantiateClass(clsObj, indexableSize);
        }
    },
    someObject: function() {
        return this.vm.image.firstOldObject;
    },
    nextObject: function(obj) {
        return this.vm.image.objectAfter(obj) || 0;
    },
    someInstanceOf: function(clsObj) {
        var someInstance = this.vm.image.someInstanceOf(clsObj);
        if (someInstance) return someInstance;
        this.success = false;
        return 0;
    },
    nextInstanceAfter: function(obj) {
        var nextInstance = this.vm.image.nextInstanceAfter(obj);
        if (nextInstance) return nextInstance;
        this.success = false;
        return 0;
    },
    primitiveFullGC: function(argCount) {
        this.vm.image.fullGC("primitive");
        var bytes = this.vm.image.bytesLeft();
        return this.popNandPushIfOK(1, this.makeLargeIfNeeded(bytes));
    },
    primitiveMakePoint: function(argCount, checkNumbers) {
        var x = this.vm.stackValue(1);
        var y = this.vm.stackValue(0);
        if (checkNumbers) {
            this.checkFloat(x);
            this.checkFloat(y);
            if (!this.success) return false;
        }
        this.vm.popNandPush(1+argCount, this.makePointWithXandY(x, y));
        return true;
    },
    primitiveStoreStackp: function(argCount) {
        var ctxt = this.stackNonInteger(1),
            newStackp = this.stackInteger(0);       
        if (!this.success || newStackp < 0 || this.vm.decodeSqueakSP(newStackp) >= ctxt.pointers.length)
            return false;
        var stackp = ctxt.pointers[Squeak.Context_stackPointer];
        while (stackp < newStackp)
            ctxt.pointers[this.vm.decodeSqueakSP(++stackp)] = this.vm.nilObj;
        ctxt.pointers[Squeak.Context_stackPointer] = newStackp;
        this.vm.popN(argCount);
        return true;
    },
    primitiveChangeClass: function(argCount) {
        if (argCount !== 1) return false;
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0);
        if (!this.success) return false;
        if (rcvr.format !== arg.format ||
            rcvr.sqClass.isCompact !== arg.sqClass.isCompact ||
            rcvr.sqClass.classInstSize() !== arg.sqClass.classInstSize())
                return false;
        rcvr.sqClass = arg.sqClass;
        return this.popNIfOK(1);
    },
    primitiveDoPrimitiveWithArgs: function(argCount) {
        var argumentArray = this.stackNonInteger(0),
            primIdx = this.stackInteger(1);
        if (!this.success) return false;
        var arraySize = argumentArray.pointersSize(),
            cntxSize = this.vm.activeContext.pointersSize();
        if (this.vm.sp + arraySize >= cntxSize) return false;
        // Pop primIndex and argArray, then push args in place...
        this.vm.popN(2);
        for (var i = 0; i < arraySize; i++)
            this.vm.push(argumentArray.pointers[i]);
        // Run the primitive
        if (this.vm.tryPrimitive(primIdx, arraySize))
            return true;
        // Primitive failed, restore state for failure code
        this.vm.popN(arraySize);
        this.vm.push(primIdx);
        this.vm.push(argumentArray);
        return false;
    },
    primitiveShortAtAndPut: function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt16Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // shortAt:
            value = array[index];
        } else { // shortAt:put:
            value = this.stackInteger(0);
            if (value < -32768 || value > 32767)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveIntegerAtAndPut:  function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt32Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // integerAt:
            value = this.signed32BitIntegerFor(array[index]);
        } else { // integerAt:put:
            value = this.stackSigned32BitInt(0);
            if (!this.success)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveConstantFill:  function(argCount) {
        var rcvr = this.stackNonInteger(1),
            value = this.stackPos32BitInt(0);
        if (!this.success || !rcvr.isWordsOrBytes())
            return false;
        var array = rcvr.words || rcvr.bytes;
        if (array) {
            if (array === rcvr.bytes && value > 255)
                return false;
            for (var i = 0; i < array.length; i++)
                array[i] = value;
        }
        this.vm.popN(argCount);
        return true;
    },
    primitiveNewMethod: function(argCount) {
        var header = this.stackInteger(0);
        var bytecodeCount = this.stackInteger(1);
        if (!this.success) return 0;
        var litCount = (header>>9) & 0xFF;
        var method = this.vm.instantiateClass(this.vm.stackValue(2), bytecodeCount);
        method.pointers = [header];
        for (var i = 0; i < litCount; i++)
            method.pointers.push(this.vm.nilObj);
        this.vm.popNandPush(1+argCount, method);
        if (this.vm.breakOnNewMethod)               // break on doit
            this.vm.breakOnMethod = method;
        return true;
    },
    primitiveExecuteMethodArgsArray: function(argCount) {
        // receiver, argsArray, then method are on top of stack.  Execute method with
        // receiver and args.
        var methodObj = this.stackNonInteger(0),
            argsArray = this.stackNonInteger(1),
            receiver = this.vm.stackValue(2);
        // Allow for up to two extra arguments (e.g. for mirror primitives).
        if (!this.success || !this.vm.isMethod(methodObj) || argCount > 4) return false;
        var numArgs = methodObj.methodNumArgs();
        if (numArgs !== argsArray.pointersSize()) return false;
        // drop all args, push receiver, and new arguments
        this.vm.popNandPush(argCount+1, receiver);
        for (var i = 0; i < numArgs; i++) 
            this.vm.push(argsArray.pointers[i]);
        this.vm.executeNewMethod(receiver, methodObj, numArgs, methodObj.methodPrimitiveIndex(), null, null);
        return true;
    },
    primitiveArrayBecome: function(argCount, doBothWays) {
        var rcvr = this.stackNonInteger(argCount),
            arg = this.stackNonInteger(argCount-1),
            copyHash = argCount > 1 ? this.stackBoolean(argCount-2) : true;
        if (!this.success) return false;
        this.success = this.vm.image.bulkBecome(rcvr.pointers, arg.pointers, doBothWays, copyHash);
        return this.popNIfOK(argCount);
    },
    doStringReplace: function() {
        var dst = this.stackNonInteger(4);
        var dstPos = this.stackInteger(3) - 1;
        var count = this.stackInteger(2) - dstPos;
        var src = this.stackNonInteger(1);
        var srcPos = this.stackInteger(0) - 1;
        if (!this.success) return dst; //some integer not right
        var srcFmt = src.format;
        var dstFmt = dst.format;
        if (dstFmt < 8)
            if (dstFmt != srcFmt) {this.success = false; return dst;} //incompatible formats
        else
            if ((dstFmt&0xC) != (srcFmt&0xC)) {this.success = false; return dst;} //incompatible formats
        if (srcFmt<4) {//pointer type objects
            var totalLength = src.pointersSize();
            var srcInstSize = src.instSize();
            srcPos += srcInstSize;
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.pointersSize();
            var dstInstSize= dst.instSize();
            dstPos += dstInstSize;
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success= false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.pointers[dstPos + i] = src.pointers[srcPos + i];
            return dst;
        } else if (srcFmt < 8) { //words type objects
            var totalLength = src.wordsSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.wordsSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.words[dstPos + i] = src.words[srcPos + i];
            return dst;
        } else { //bytes type objects
            var totalLength = src.bytesSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.bytesSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.bytes[dstPos + i] = src.bytes[srcPos + i];
            return dst;
        }
    },
    primitiveCopyObject: function(argCount) {
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0),
            length = rcvr.pointersSize();
        if (!this.success ||
            rcvr.isWordsOrBytes() ||
            rcvr.sqClass !== arg.sqClass ||
            length !== arg.pointersSize()) return false;
        for (var i = 0; i < length; i++)
            arg.pointers[i] = rcvr.pointers[i];
        this.vm.pop(argCount);
        return true;
    },
    primitiveLoadImageSegment: function(argCount) {
        var segmentWordArray = this.stackNonInteger(1),
            outPointerArray = this.stackNonInteger(0);
        if (!segmentWordArray.words || !outPointerArray.pointers) return false;
        var roots = this.vm.image.loadImageSegment(segmentWordArray, outPointerArray);
        if (!roots) return false;
        return this.popNandPushIfOK(argCount + 1, roots);
    },
},
'blocks/closures', {
    doBlockCopy: function() {
        var rcvr = this.vm.stackValue(1);
        var sqArgCount = this.stackInteger(0);
        var homeCtxt = rcvr;
        if(!this.vm.isContext(homeCtxt)) this.success = false;
        if(!this.success) return rcvr;
        if (typeof homeCtxt.pointers[Squeak.Context_method] === "number")
            // ctxt is itself a block; get the context for its enclosing method
            homeCtxt = homeCtxt.pointers[Squeak.BlockContext_home];
        var blockSize = homeCtxt.pointersSize() - homeCtxt.instSize(); // could use a const for instSize
        var newBlock = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassBlockContext], blockSize);
        var initialPC = this.vm.encodeSqueakPC(this.vm.pc + 2, this.vm.method); //*** check this...
        newBlock.pointers[Squeak.BlockContext_initialIP] = initialPC;
        newBlock.pointers[Squeak.Context_instructionPointer] = initialPC; // claim not needed; value will set it
        newBlock.pointers[Squeak.Context_stackPointer] = 0;
        newBlock.pointers[Squeak.BlockContext_argumentCount] = sqArgCount;
        newBlock.pointers[Squeak.BlockContext_home] = homeCtxt;
        newBlock.pointers[Squeak.Context_sender] = this.vm.nilObj; // claim not needed; just initialized
        return newBlock;
    },
    primitiveBlockValue: function(argCount) {
        var rcvr = this.vm.stackValue(argCount);
        if (!this.isA(rcvr, Squeak.splOb_ClassBlockContext)) return false;
        var block = rcvr;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != argCount) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(this.vm.activeContext.pointers, this.vm.sp-argCount+1, block.pointers, Squeak.Context_tempFrameStart, argCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = argCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContext;
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        return true;
    },
    primitiveBlockValueWithArgs: function(argCount) {
        var block = this.vm.stackValue(1);
        var array = this.vm.stackValue(0);
        if (!this.isA(block, Squeak.splOb_ClassBlockContext)) return false;
        if (!this.isA(array, Squeak.splOb_ClassArray)) return false;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != array.pointersSize()) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(array.pointers, 0, block.pointers, Squeak.Context_tempFrameStart, blockArgCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = blockArgCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContext;
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        return true;
    },
    primitiveClosureCopyWithCopiedValues: function(argCount) {
        this.vm.breakNow("primitiveClosureCopyWithCopiedValues");
        debugger;
        return false;
    },
    primitiveClosureValue: function(argCount) {
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        return this.activateNewClosureMethod(blockClosure, argCount);
	},
    primitiveClosureValueWithArgs: function(argCount) {
        var array = this.vm.top(),
            arraySize = array.pointersSize(),
            blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (arraySize !== blockArgCount) return false;
        this.vm.pop();
        for (var i = 0; i < arraySize; i++)
            this.vm.push(array.pointers[i]);
        return this.activateNewClosureMethod(blockClosure, arraySize);
	},
    primitiveClosureValueNoContextSwitch: function(argCount) {
        return this.primitiveClosureValue(argCount);
    },
    activateNewClosureMethod: function(blockClosure, argCount) {
        var outerContext = blockClosure.pointers[Squeak.Closure_outerContext],
            method = outerContext.pointers[Squeak.Context_method],
            newContext = this.vm.allocateOrRecycleContext(method.methodNeedsLargeFrame()),
            numCopied = blockClosure.pointers.length - Squeak.Closure_firstCopiedValue;
        newContext.pointers[Squeak.Context_sender] = this.vm.activeContext;
        newContext.pointers[Squeak.Context_instructionPointer] = blockClosure.pointers[Squeak.Closure_startpc];
        newContext.pointers[Squeak.Context_stackPointer] = argCount + numCopied;
        newContext.pointers[Squeak.Context_method] = outerContext.pointers[Squeak.Context_method];
        newContext.pointers[Squeak.Context_closure] = blockClosure;
        newContext.pointers[Squeak.Context_receiver] = outerContext.pointers[Squeak.Context_receiver];
        // Copy the arguments and copied values ...
        var where = Squeak.Context_tempFrameStart;
        for (var i = 0; i < argCount; i++)
            newContext.pointers[where++] = this.vm.stackValue(argCount - i - 1);
        for (var i = 0; i < numCopied; i++)
            newContext.pointers[where++] = blockClosure.pointers[Squeak.Closure_firstCopiedValue + i];
        // The initial instructions in the block nil-out remaining temps.
        this.vm.popN(argCount + 1);
        this.vm.newActiveContext(newContext);
        return true;
	},
},
'scheduling',
{
    primitiveResume: function() {
        this.resume(this.vm.top());
        return true;
	},
    primitiveSuspend: function() {
        var activeProc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
        if (this.vm.top() !== activeProc) return false;
        this.vm.popNandPush(1, this.vm.nilObj);
        this.transferTo(this.pickTopProcess());
        return true;
    },
    getScheduler: function() {
        var assn = this.vm.specialObjects[Squeak.splOb_SchedulerAssociation];
        return assn.pointers[Squeak.Assn_value];
    },
    resume: function(newProc) {
        var activeProc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
        var activePriority = activeProc.pointers[Squeak.Proc_priority];
        var newPriority = newProc.pointers[Squeak.Proc_priority];
        if (newPriority > activePriority) {
            this.putToSleep(activeProc);
            this.transferTo(newProc);
        } else {
            this.putToSleep(newProc);
        }
    },
    putToSleep: function(aProcess) {
        //Save the given process on the scheduler process list for its priority.
        var priority = aProcess.pointers[Squeak.Proc_priority];
        var processLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var processList = processLists.pointers[priority - 1];
        this.linkProcessToList(aProcess, processList);
    },
    transferTo: function(newProc) {
        //Record a process to be awakened on the next interpreter cycle.
        var sched = this.getScheduler();
        var oldProc = sched.pointers[Squeak.ProcSched_activeProcess];
        sched.pointers[Squeak.ProcSched_activeProcess] = newProc;
        oldProc.pointers[Squeak.Proc_suspendedContext] = this.vm.activeContext;
        this.vm.newActiveContext(newProc.pointers[Squeak.Proc_suspendedContext]);
        newProc.pointers[Squeak.Proc_suspendedContext] = this.vm.nilObj;
        this.vm.reclaimableContextCount = 0;
        if (this.vm.breakOnContextChanged) {
            this.vm.breakOnContextChanged = false;
            this.vm.breakNow();
        }
    },
    pickTopProcess: function() { // aka wakeHighestPriority
        //Return the highest priority process that is ready to run.
        //Note: It is a fatal VM error if there is no runnable process.
        var schedLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var p = schedLists.pointersSize() - 1;  // index of last indexable field
        var processList;
        do {
            if (p < 0) throw Error("scheduler could not find a runnable process");
            processList = schedLists.pointers[p--];
        } while (this.isEmptyList(processList));
        return this.removeFirstLinkOfList(processList);
	},    
    linkProcessToList: function(proc, aList) {
        // Add the given process to the given linked list and set the backpointer
        // of process to its new list.
        if (this.isEmptyList(aList))
            aList.pointers[Squeak.LinkedList_firstLink] = proc;
        else {
            var lastLink = aList.pointers[Squeak.LinkedList_lastLink];
            lastLink.pointers[Squeak.Link_nextLink] = proc;
        }
        aList.pointers[Squeak.LinkedList_lastLink] = proc;
        proc.pointers[Squeak.Proc_myList] = aList;
    },
    isEmptyList: function(aLinkedList) {
        return aLinkedList.pointers[Squeak.LinkedList_firstLink].isNil;
    },
    removeFirstLinkOfList: function(aList) {
        //Remove the first process from the given linked list.
        var first = aList.pointers[Squeak.LinkedList_firstLink];
        var last = aList.pointers[Squeak.LinkedList_lastLink];
        if (first === last) {
            aList.pointers[Squeak.LinkedList_firstLink] = this.vm.nilObj;
            aList.pointers[Squeak.LinkedList_lastLink] = this.vm.nilObj;
        } else {
            var next = first.pointers[Squeak.Link_nextLink];
            aList.pointers[Squeak.LinkedList_firstLink] = next;
        }
        first.pointers[Squeak.Link_nextLink] = this.vm.nilObj;
        return first;
    },
    registerSemaphore: function(specialObjIndex) {
        var sema = this.vm.top();
        if (this.isA(sema, Squeak.splOb_ClassSemaphore))
            this.vm.specialObjects[specialObjIndex] = sema;
        else
            this.vm.specialObjects[specialObjIndex] = this.vm.nilObj;
        return this.vm.stackValue(1);
    },
    primitiveWait: function() {
    	var sema = this.vm.top();
        if (!this.isA(sema, Squeak.splOb_ClassSemaphore)) return false;
        var excessSignals = sema.pointers[Squeak.Semaphore_excessSignals];
        if (excessSignals > 0)
            sema.pointers[Squeak.Semaphore_excessSignals] = excessSignals - 1;
        else {
            var activeProc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
            this.linkProcessToList(activeProc, sema);
            this.transferTo(this.pickTopProcess());
        }
        return true;
    },
    primitiveSignal: function() {
	    var sema = this.vm.top();
        if (!this.isA(sema, Squeak.splOb_ClassSemaphore)) return false;
        this.synchronousSignal(sema);
        return true;
    },
    synchronousSignal: function(sema) {
    	if (this.isEmptyList(sema)) {
            // no process is waiting on this semaphore
            sema.pointers[Squeak.Semaphore_excessSignals]++;
        } else
            this.resume(this.removeFirstLinkOfList(sema));
        return;
    },
    primitiveSignalAtMilliseconds: function(argCount) { //Delay signal:atMs:
        var msTime = this.stackInteger(0);
        var sema = this.stackNonInteger(1);
        var rcvr = this.stackNonInteger(2);
        if (!this.success) return false;
        if (this.isA(sema, Squeak.splOb_ClassSemaphore)) {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = sema;
            this.vm.nextWakeupTick = msTime;
        } else {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = this.vm.nilObj;
            this.vm.nextWakeupTick = 0;
        }
        this.vm.popN(argCount); // return self
        return true;
	},
	signalSemaphoreWithIndex: function(semaIndex) {
	    // asynch signal: will actually be signaled in checkForInterrupts()
    	this.semaphoresToSignal.push(semaIndex);
	},
    signalExternalSemaphores: function() {
        var semaphores = this.vm.specialObjects[Squeak.splOb_ExternalObjectsArray].pointers,
            semaClass = this.vm.specialObjects[Squeak.splOb_ClassSemaphore];
        while (this.semaphoresToSignal.length) {
            var semaIndex = this.semaphoresToSignal.shift(),
                sema = semaphores[semaIndex - 1];
            if (sema.sqClass == semaClass)
                this.synchronousSignal(sema);
        }
    },
},
'vm functions', {
    primitiveGetAttribute: function(argCount) {
        var attr = this.stackInteger(0);
        if (!this.success) return false;
        var value;
        switch (attr) {
            case 0: value = this.filenameToSqueak(Squeak.vmPath + Squeak.vmFile); break;
            case 1: value = this.display.documentName || null; break; // 1.x images want document here
            case 2: value = this.display.documentName || null; break; // later images want document here
            case 1001: value = Squeak.platformName; break;
            case 1002: value = Squeak.osVersion; break;
            case 1003: value = Squeak.platformSubtype; break;
            case 1004: value = Squeak.vmVersion; break;
            case 1005: value = Squeak.windowSystem; break;
            case 1006: value = Squeak.vmBuild; break;
            case 1007: value = Squeak.vmVersion; break; // Interpreter class
            // case 1008: Cogit class
            case 1009: value = Squeak.vmVersion; break; // Platform source version
            default: return false;
        }
        this.vm.popNandPush(argCount+1, this.makeStObject(value));
        return true;
	},
    setLowSpaceThreshold: function() {
        var nBytes = this.stackInteger(0);
        if (this.success) this.vm.lowSpaceThreshold = nBytes;
        return this.vm.stackValue(1);
    },
    primitiveVMParameter: function(argCount) {
        /* Behaviour depends on argument count:
		0 args:	return an Array of VM parameter values;
		1 arg:	return the indicated VM parameter;
		2 args:	set the VM indicated parameter. */
		var paramsArraySize = 41;
		switch (argCount) {
            case 0:
                var arrayObj = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], paramsArraySize);
                for (var i = 0; i < paramsArraySize; i++)
                    arrayObj.pointers[i] = this.makeStObject(this.vmParameterAt(i+1));
                return this.popNandPushIfOK(1, arrayObj);
            case 1:
                var parm = this.stackInteger(0);
                return this.popNandPushIfOK(2, this.makeStObject(this.vmParameterAt(parm)));
            case 2:
                return this.popNandPushIfOK(3, 0);
		};
		return false;
    },
    vmParameterAt: function(index) {
        switch (index) {
            case 1: return this.vm.image.oldSpaceBytes;     // end of old-space (0-based, read-only)
            case 2: return this.vm.image.oldSpaceBytes;     // end of young-space (read-only)
            case 3: return this.vm.image.totalMemory;       // end of memory (read-only)
            case 4: return this.vm.image.allocationCount + this.vm.image.newSpaceCount; // allocationCount (read-only; nil in Cog VMs)
            // 5    allocations between GCs (read-write; nil in Cog VMs)
            // 6    survivor count tenuring threshold (read-write)
            case 7: return this.vm.image.gcCount;           // full GCs since startup (read-only)
            case 8: return this.vm.image.gcMilliseconds;    // total milliseconds in full GCs since startup (read-only)
            case 9: return 1;   /* image expects > 0 */     // incremental GCs since startup (read-only)
            case 10: return 0;                              // total milliseconds in incremental GCs since startup (read-only)
            case 11: return this.vm.image.gcTenured;        // tenures of surving objects since startup (read-only)
            // 12-20 specific to the translating VM
            // 21	root table size (read-only)
            // 22	root table overflows since startup (read-only)
            // 23	bytes of extra memory to reserve for VM buffers, plugins, etc.
            // 24	memory threshold above which to shrink object memory (read-write)
            // 25	memory headroom when growing object memory (read-write)
            // 26	interruptChecksEveryNms - force an ioProcessEvents every N milliseconds (read-write)
            // 27	number of times mark loop iterated for current IGC/FGC (read-only) includes ALL marking
            // 28	number of times sweep loop iterated for current IGC/FGC (read-only)
            // 29	number of times make forward loop iterated for current IGC/FGC (read-only)
            // 30	number of times compact move loop iterated for current IGC/FGC (read-only)
            // 31	number of grow memory requests (read-only)
            // 32	number of shrink memory requests (read-only)
            // 33	number of root table entries used for current IGC/FGC (read-only)
            // 34	number of allocations done before current IGC/FGC (read-only)
            // 35	number of survivor objects after current IGC/FGC (read-only)
            // 36	millisecond clock when current IGC/FGC completed (read-only)
            // 37	number of marked objects for Roots of the world, not including Root Table entries for current IGC/FGC (read-only)
            // 38	milliseconds taken by current IGC (read-only)
            // 39	Number of finalization signals for Weak Objects pending when current IGC/FGC completed (read-only)
            case 40: return 4; // BytesPerWord for this image
            case 41: return this.vm.image.formatVersion();
        }
        return null;
    },
    primitiveImageName: function(argCount) {
        if (argCount == 0)
            return this.popNandPushIfOK(1, this.makeStString(this.filenameToSqueak(this.vm.image.name)));
        this.vm.image.name = this.filenameFromSqueak(this.vm.top().bytesAsString());
        window.localStorage['squeakImageName'] = this.vm.image.name;
        return true;
    },
    primitiveSnapshot: function(argCount) {
        this.vm.popNandPush(1, this.vm.trueObj);        // put true on stack for saved snapshot
        this.vm.storeContextRegisters();                // store current state for snapshot
        var proc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
        proc.pointers[Squeak.Proc_suspendedContext] = this.vm.activeContext; // store initial context
        this.vm.image.fullGC("snapshot");               // before cleanup so traversal works
        var buffer = this.vm.image.writeToBuffer();
        Squeak.flushAllFiles();                         // so there are no more writes pending
        Squeak.filePut(this.vm.image.name, buffer);
        this.vm.popNandPush(1, this.vm.falseObj);       // put false on stack for continuing
        return true;
    },
    primitiveQuit: function(argCount) {
        Squeak.flushAllFiles();
        this.display.quitFlag = true;
        this.vm.breakNow("quit"); 
        return true;
    },
    primitiveExitToDebugger: function(argCount) {
        this.vm.breakNow("debugger primitive");
        debugger;
        return true;
    },
    primitiveSetGCBiasToGrow: function(argCount) {
        return this.fakePrimitive(".primitiveSetGCBiasToGrow", 0, argCount);
    },
    primitiveSetGCBiasToGrowGCLimit: function(argCount) {
        return this.fakePrimitive(".primitiveSetGCBiasToGrowGCLimit", 0, argCount);
    },
},
'display', {
    primitiveBeCursor: function(argCount) {
        this.vm.popN(argCount); // return self
        return true;
    },
    primitiveBeDisplay: function(argCount) {
        var displayObj = this.vm.stackValue(0);
        this.vm.specialObjects[Squeak.splOb_TheDisplay] = displayObj;
        this.vm.popN(argCount); // return self
        return true;
	},
    primitiveReverseDisplay: function(argCount) {
        this.reverseDisplay = !this.reverseDisplay;
        this.redrawDisplay();
        return true;
    },
    primitiveShowDisplayRect: function(argCount) {
        // Force the given rectangular section of the Display to be copied to the screen.
        var rect = {
            left: this.stackInteger(3),
            right: this.stackInteger(2),
            top: this.stackInteger(1),
            bottom: this.stackInteger(0),
        };
        if (!this.success) return false;
        this.redrawDisplay(rect);
        this.vm.popN(argCount);
        return true;
    },
    redrawDisplay: function(rect) {
        var theDisplay = this.theDisplay(),
            bounds = {left: 0, top: 0, right: theDisplay.width, bottom: theDisplay.height};
        if (rect) {
            if (rect.left > bounds.left) bounds.left = rect.left;
            if (rect.right < bounds.right) bounds.right = rect.right;
            if (rect.top > bounds.top) bounds.top = rect.top;
            if (rect.bottom < bounds.bottom) bounds.bottom = rect.bottom;
        }
        if (bounds.left < bounds.right && bounds.top < bounds.bottom)
            this.displayUpdate(theDisplay, bounds);
    },
    showForm: function(ctx, form, rect) {
        if (!rect) return;
        var srcX = rect.left,
            srcY = rect.top,
            srcW = rect.right - srcX,
            srcH = rect.bottom - srcY,
            pixels = ctx.createImageData(srcW, srcH),
            pixelData = pixels.data;
        if (!pixelData.buffer) { // mobile IE uses a different data-structure
            pixelData = new Uint8Array(srcW * srcH * 4);
        }
        var dest = new Uint32Array(pixelData.buffer);
        switch (form.depth) {
            case 1:
            case 2:
            case 4:
            case 8:
                var colors = this.swappedColors;
                if (!colors) {
                    colors = [];
                    for (var i = 0; i < 256; i++) {
                        var argb = this.indexedColors[i],
                            abgr = (argb & 0xFF00FF00)     // green and alpha
                            + ((argb & 0x00FF0000) >> 16)  // shift red down
                            + ((argb & 0x000000FF) << 16); // shift blue up
                        colors[i] = abgr;
                    }
                    this.swappedColors = colors;
                }
                if (this.reverseDisplay) {
                    if (!this.reversedColors)
                        this.reversedColors = colors.map(function(c){return c ^ 0x00FFFFFF});
                    colors = this.reversedColors;
                }
                var mask = (1 << form.depth) - 1;
                var leftSrcShift = 32 - (srcX % form.pixPerWord + 1) * form.depth;
                for (var y = 0; y < srcH; y++) {
                    var srcIndex = form.pitch * srcY + (srcX / form.pixPerWord | 0);
                    var srcShift = leftSrcShift;
                    var src = form.bits[srcIndex];
                    var dstIndex = pixels.width * y;
                    for (var x = 0; x < srcW; x++) {
                        dest[dstIndex++] = colors[(src >>> srcShift) & mask]; 
                        if ((srcShift -= form.depth) < 0) {
                            srcShift = 32 - form.depth;
                            src = form.bits[++srcIndex];
                        }
                    }
                    srcY++;
                };
                break;
            case 16:
                var leftSrcShift = srcX % 2 ? 0 : 16;
                for (var y = 0; y < srcH; y++) {
                    var srcIndex = form.pitch * srcY + (srcX / 2 | 0);
                    var srcShift = leftSrcShift;
                    var src = form.bits[srcIndex];
                    var dstIndex = pixels.width * y;
                    for (var x = 0; x < srcW; x++) {
                        var rgb = src >>> srcShift;
                        dest[dstIndex++] =
                            ((rgb & 0x7C00) >> 7)     // shift red   down 2*5, up 0*8 + 3
                            + ((rgb & 0x03E0) << 6)   // shift green down 1*5, up 1*8 + 3
                            + ((rgb & 0x001F) << 19)  // shift blue  down 0*5, up 2*8 + 3
                            + 0xFF000000;             // set alpha to opaque 
                        if ((srcShift -= 16) < 0) {
                            srcShift = 16;
                            src = form.bits[++srcIndex];
                        }
                    }
                    srcY++;
                };
                break;
            case 32:
                for (var y = 0; y < srcH; y++) {
                    var srcIndex = form.pitch * srcY + srcX;
                    var dstIndex = pixels.width * y;
                    for (var x = 0; x < srcW; x++) {
                        var argb = form.bits[srcIndex++];  // convert ARGB -> ABGR
                        var abgr = (argb & 0x0000FF00)     // green is okay
                            + ((argb & 0x00FF0000) >> 16)  // shift red down
                            + ((argb & 0x000000FF) << 16)  // shift blue up
                            + 0xFF000000;                  // set alpha to opaque
                        dest[dstIndex++] = abgr;
                    }
                    srcY++;
                };
                break;
            default: throw Error("depth not implemented");
        };
        if (pixels.data !== pixelData) {
            pixels.data.set(pixelData);
        }
        ctx.putImageData(pixels, rect.left + (rect.offsetX || 0), rect.top + (rect.offsetY || 0));
    },
    primitiveDeferDisplayUpdates: function(argCount) {
        var flag = this.stackBoolean(0);
        if (!this.success) return false;
        this.deferDisplayUpdates = flag;
        this.vm.popN(argCount);
        return true;
    },
    primitiveForceDisplayUpdate: function(argCount) {
        this.vm.breakOut();   // show on screen
        this.vm.popN(argCount);
        return true;
    },
    primitiveScreenSize: function(argCount) {
        var display = this.display,
            w = display.width || display.context.canvas.width,
            h = display.height || display.context.canvas.height;
        return this.popNandPushIfOK(argCount+1, this.makePointWithXandY(w, h));
    },
    primitiveSetFullScreen: function(argCount) {
        var flag = this.stackBoolean(0);
        if (!this.success) return false;
        if (this.display.fullscreen != flag) {
            if (this.display.fullscreenRequest) {
                // freeze until we get the right display size
                var unfreeze = this.vm.freeze();
                this.display.fullscreenRequest(flag, function thenDo() {
                    unfreeze();
                });
            } else {
                this.display.fullscreen = flag;
                this.vm.breakOut(); // let VM go into fullscreen mode
            }
        }
        this.vm.popN(argCount);
        return true;
    },
    primitiveTestDisplayDepth: function(argCount) {
        var supportedDepths =  [1, 2, 4, 8, 16, 32]; // match showOnDisplay()
        return this.pop2andPushBoolIfOK(supportedDepths.indexOf(this.stackInteger(0)) >= 0);
    },
    loadForm: function(formObj) {
        if (formObj.isNil) return null;
        var form = {
            obj: formObj,
            bits: formObj.pointers[Squeak.Form_bits].wordsOrBytes(),
            depth: formObj.pointers[Squeak.Form_depth],
            width: formObj.pointers[Squeak.Form_width],
            height: formObj.pointers[Squeak.Form_height],
        }
        if (form.width === 0 || form.height === 0) return form;
        if (!(form.width > 0 && form.height > 0)) return null;
        form.msb = form.depth > 0;
        if (!form.msb) form.depth = -form.depth;
        if (!(form.depth > 0)) return null; // happens if not int
        form.pixPerWord = 32 / form.depth;
        form.pitch = (form.width + (form.pixPerWord - 1)) / form.pixPerWord | 0;
        if (form.bits.length !== (form.pitch * form.height)) return null;
        return form;
    },
    theDisplay: function() {
        return this.loadForm(this.vm.specialObjects[Squeak.splOb_TheDisplay]);
    },
    displayDirty: function(form, rect) {
        if (!this.deferDisplayUpdates
            && form == this.vm.specialObjects[Squeak.splOb_TheDisplay])
                this.displayUpdate(this.theDisplay(), rect);
    },
    displayUpdate: function(form, rect, noCursor) {
        this.display.lastTick = this.vm.lastTick;
        this.display.idle = 0;
        rect.offsetX = this.display.offsetX;
        rect.offsetY = this.display.offsetY;
        this.showForm(this.display.context, form, rect);
        if (noCursor) return;
        // show cursor if it was just overwritten
        if (this.cursorX + this.cursorW > rect.left && this.cursorX < rect.right &&
            this.cursorY + this.cursorH > rect.top && this.cursorY < rect.bottom) 
                this.cursorDraw();
    },
    cursorUpdate: function() {
        var x = this.display.mouseX - this.cursorOffsetX,
            y = this.display.mouseY - this.cursorOffsetY;
        if (x === this.cursorX && y === this.cursorY && !force) return;
        var oldBounds = {left: this.cursorX, top: this.cursorY, right: this.cursorX + this.cursorW, bottom: this.cursorY + this.cursorH };
        this.cursorX = x;
        this.cursorY = y;
        // restore display at old cursor pos
        this.displayUpdate(this.theDisplay(), oldBounds, true);
        // draw cursor at new pos
        this.cursorDraw();
    },
    cursorDraw: function() {
        // TODO: create cursorCanvas in setCursor primitive
        // this.display.context.drawImage(this.cursorCanvas, this.cursorX, this.cursorY);
    },
    primitiveBeep: function(argCount) {
        var ctx = Squeak.startAudioOut();
        if (ctx) {
            var beep = ctx.createOscillator();
            beep.connect(ctx.destination);
            beep.frequency.value = 880;
            beep.noteOn(0);
            beep.noteOff(ctx.currentTime + 0.2);
        } else {
            this.vm.warnOnce("could not initialize audio");
        }
        return this.popNIfOK(argCount);
    },
},
'input', {
	primitiveClipboardText: function(argCount) {
        if (argCount === 0) { // read from clipboard
            if (typeof(this.display.clipboardString) !== 'string') return false;
            this.vm.popNandPush(1, this.makeStString(this.display.clipboardString));
        } else if (argCount === 1) { // write to clipboard
            var stringObj = this.vm.top();
            if (stringObj.bytes) {
                this.display.clipboardString = stringObj.bytesAsString();
                this.display.clipboardStringChanged = true;
            }
            this.vm.pop();
        }
        return true;
	},
    primitiveKeyboardNext: function(argCount) {
        return this.popNandPushIfOK(argCount+1, this.ensureSmallInt(this.display.keys.shift()));
    },
    primitiveKeyboardPeek: function(argCount) {
        var length = this.display.keys.length;
        return this.popNandPushIfOK(argCount+1, length ? this.ensureSmallInt(this.display.keys[0] || 0) : this.vm.nilObj);
    },
    primitiveMouseButtons: function(argCount) {
        // only used in non-event based (old MVC) images
        this.popNandPushIfOK(argCount+1, this.ensureSmallInt(this.display.buttons));
        // if the image calls this primitive it means it's done displaying
        // we break out of the VM so the browser shows it quickly
        this.vm.breakOut();
        // if nothing was drawn but the image looks at the buttons rapidly,
        // it must be idle.
        if (this.display.idle++ > 20)
            this.vm.goIdle(); // might switch process, so must be after pop
        return true;
    },
    primitiveMousePoint: function(argCount) {
        var x = this.ensureSmallInt(this.display.mouseX),
            y = this.ensureSmallInt(this.display.mouseY);
        return this.popNandPushIfOK(argCount+1, this.makePointWithXandY(x, y));
    },
    primitiveInputSemaphore: function(argCount) {
        var semaIndex = this.stackInteger(0);
        if (!this.success) return false;
        this.inputEventSemaIndex = semaIndex;
        this.display.signalInputEvent = function() {
            this.signalSemaphoreWithIndex(this.inputEventSemaIndex);
        }.bind(this);
        return true;
    },
    primitiveInputWord: function(argCount) {
        // Return an integer indicating the reason for the most recent input interrupt
        return this.popNandPushIfOK(1, 0);      // noop for now
    },
    primitiveGetNextEvent: function(argCount) {
        this.display.idle++;
        var evtBuf = this.stackNonInteger(0);
        if (!this.display.getNextEvent) return false;
        this.display.getNextEvent(evtBuf.pointers, this.vm.startupTime);
        return true;
    },
},
'time', {
    primitiveRelinquishProcessorForMicroseconds: function(argCount) {
        // we ignore the optional arg
        this.vm.pop(argCount);
        this.vm.goIdle();        // might switch process, so must be after pop
        return true;
    },
	millisecondClockValue: function() {
        //Return the value of the millisecond clock as an integer.
        //Note that the millisecond clock wraps around periodically.
        //The range is limited to SmallInteger maxVal / 2 to allow
        //delays of up to that length without overflowing a SmallInteger.
        return (Date.now() - this.vm.startupTime) & Squeak.MillisecondClockMask;
	},
	millisecondClockValueSet: function(clock) {
        // set millisecondClock to the (previously saved) clock value 
        // to allow "stopping" the VM clock while debugging
        this.vm.startupTime = Date.now() - clock;
	},
	secondClock: function() {
        return this.pos32BitIntFor(Squeak.totalSeconds()); // will overflow 32 bits in 2037
    },
    microsecondClockUTC: function() {
        var millis = Date.now() - Squeak.EpochUTC;
        return this.pos64BitIntFor(millis * 1000);
    },
    microsecondClockLocal: function() {
        var millis = Date.now() - Squeak.Epoch;
        return this.pos64BitIntFor(millis * 1000);
    },
},
'FilePlugin', {
    primitiveDirectoryCreate: function(argCount) {
        var dirNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var dirName = this.filenameFromSqueak(dirNameObj.bytesAsString());
        this.success = Squeak.dirCreate(dirName);
        if (!this.success) {
            var path = Squeak.splitFilePath(dirName);
            console.log("Directory not created: " + path.fullname);
        }
        return this.popNIfOK(argCount);
    },
    primitiveDirectoryDelete: function(argCount) {
        var dirNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var dirName = this.filenameFromSqueak(dirNameObj.bytesAsString());
        this.success = Squeak.dirDelete(dirName);
        return this.popNIfOK(argCount);
    },
    primitiveDirectoryDelimitor: function(argCount) {
        var delimitor = this.emulateMac ? ':' : '/';
        return this.popNandPushIfOK(1, this.charFromInt(delimitor.charCodeAt(0)));
    },
    primitiveDirectoryEntry: function(argCount) {
        this.vm.warnOnce("Not yet implemented: primitiveDirectoryEntry");
        return false; // image falls back on primitiveDirectoryLookup
    },
    primitiveDirectoryLookup: function(argCount) {
        var index = this.stackInteger(0),
            dirNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var sqDirName = dirNameObj.bytesAsString();
        var dirName = this.filenameFromSqueak(sqDirName);
        var entries = Squeak.dirList(dirName, true);
        if (!entries) {
            var path = Squeak.splitFilePath(dirName);
            console.log("Directory not found: " + path.fullname);
            return false;
        }
        var keys = Object.keys(entries).sort(),
            entry = entries[keys[index - 1]];
        if (sqDirName === "/") { // fake top-level dir
            if (index === 1) {
                if (!entry) entry = [0, 0, 0, 0, 0];
                entry[0] = "SqueakJS";
                entry[3] = true;
            }
            else entry = null;
        }
        this.popNandPushIfOK(argCount+1, this.makeStObject(entry));  // entry or nil
        return true;
    },
    primitiveDirectorySetMacTypeAndCreator: function(argCount) {
        return this.popNIfOK(argCount);
    },
    primitiveFileAtEnd: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.popNandPushIfOK(argCount+1, this.makeStObject(handle.filePos >= handle.file.size));
        return true;
    },
    primitiveFileClose: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.fileClose(handle.file);
        this.vm.breakOut();     // return to JS asap so async file handler can run
        handle.file = null;
        return this.popNIfOK(argCount);
    },
    primitiveFileDelete: function(argCount) {
        var fileNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var fileName = this.filenameFromSqueak(fileNameObj.bytesAsString());
        this.success = Squeak.fileDelete(fileName);
        return this.popNIfOK(argCount);
    },
    primitiveFileFlush: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        Squeak.flushFile(handle.file);
        this.vm.breakOut();     // return to JS asap so async file handler can run
        return this.popNIfOK(argCount);
    },
    primitiveFileGetPosition: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(handle.filePos));
        return true;
    },
    primitiveFileOpen: function(argCount) {
        var writeFlag = this.stackBoolean(0),
            fileNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var fileName = this.filenameFromSqueak(fileNameObj.bytesAsString()),
            file = this.fileOpen(fileName, writeFlag);
        if (!file) return false;
        var handle = this.makeStArray([file.name]); // array contents irrelevant
        handle.file = file;             // shared between handles
        handle.fileWrite = writeFlag;   // specific to this handle
        handle.filePos = 0;             // specific to this handle
        this.popNandPushIfOK(argCount+1, handle);
        return true;
    },
    primitiveFileRead: function(argCount) {
        var count = this.stackInteger(0),
            startIndex = this.stackInteger(1) - 1, // make zero based
            arrayObj = this.stackNonInteger(2),
            handle = this.stackNonInteger(3);
        if (!this.success || !handle.file) return false;
        if (!count) return this.popNandPushIfOK(argCount+1, 0);
        if (!arrayObj.bytes) {
            console.log("File reading into non-bytes object not implemented yet");
            return false;
        }
        if (startIndex < 0 || startIndex + count > arrayObj.bytes.length)
            return false;
        return this.fileContentsDo(handle.file, function(file) {
            if (!file.contents)
                return this.popNandPushIfOK(argCount+1, 0);
            var srcArray = file.contents,
                dstArray = arrayObj.bytes;
            count = Math.min(count, file.size - handle.filePos);
            for (var i = 0; i < count; i++)
                dstArray[startIndex + i] = srcArray[handle.filePos++];
            this.popNandPushIfOK(argCount+1, count);
        }.bind(this));
    },
    primitiveFileRename: function(argCount) {
        var oldNameObj = this.stackNonInteger(1),
            newNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var oldName = this.filenameFromSqueak(oldNameObj.bytesAsString()),
            newName = this.filenameFromSqueak(newNameObj.bytesAsString());
        this.success = Squeak.fileRename(oldName, newName);
        this.vm.breakOut();     // return to JS asap so async file handler can run
        return this.popNIfOK(argCount);
    },
    primitiveFileSetPosition: function(argCount) {
        var pos = this.stackPos32BitInt(0),
            handle = this.stackNonInteger(1);
        if (!this.success || !handle.file) return false;
        handle.filePos = pos;
        return this.popNIfOK(argCount);
    },
    primitiveFileSize: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.popNandPushIfOK(argCount+1, this.makeLargeIfNeeded(handle.file.size));
        return true;
    },
    primitiveFileStdioHandles: function(argCount) {
        this.vm.warnOnce("Not yet implemented: primitiveFileStdioHandles");
        return false;
    },
    primitiveFileTruncate: function(argCount) {
        console.warn("Not yet implemented: primitiveFileTruncate");
        return false;
    },
    primitiveDisableFileAccess: function(argCount) {
        return this.fakePrimitive("FilePlugin.primitiveDisableFileAccess", 0, argCount);
    },
    primitiveFileWrite: function(argCount) {
        var count = this.stackInteger(0),
            startIndex = this.stackInteger(1) - 1, // make zero based
            arrayObj = this.stackNonInteger(2),
            handle = this.stackNonInteger(3);
        if (!this.success || !handle.file || !handle.fileWrite) return false;
        if (!count) return this.popNandPushIfOK(argCount+1, 0);
        var array = arrayObj.bytes || arrayObj.wordsAsUint8Array();
        if (!array) return false;
        if (startIndex < 0 || startIndex + count > array.length)
            return false;
        return this.fileContentsDo(handle.file, function(file) {
            var srcArray = array,
                dstArray = file.contents || [];
            if (handle.filePos + count > dstArray.length) {
                var newSize = dstArray.length === 0 ? handle.filePos + count :
                    Math.max(handle.filePos + count, dstArray.length + 10000);
                file.contents = new Uint8Array(newSize);
                file.contents.set(dstArray);
                dstArray = file.contents;
            }
            for (var i = 0; i < count; i++)
                dstArray[handle.filePos++] = srcArray[startIndex + i];
            if (handle.filePos > file.size) file.size = handle.filePos;
            file.modified = true;
            this.popNandPushIfOK(argCount+1, count);
        }.bind(this));
    },
    fileOpen: function(filename, writeFlag) {
        // if a file is opened for read and write at the same time,
        // they must share the contents. That's why all open files
        // are held in the ref-counted global SqueakFiles
        if (typeof SqueakFiles == 'undefined')
            window.SqueakFiles = {};
        var path = Squeak.splitFilePath(filename);
        if (!path.basename) return null;    // malformed filename
        // fetch or create directory entry
        var directory = Squeak.dirList(path.dirname, true);
        if (!directory) return null;
        var entry = directory[path.basename],
            contents = null;
        if (entry) {
            // if it is open already, return it
            var file = SqueakFiles[path.fullname];
            if (file) {
                ++file.refCount;
                return file;
            }
        } else {
            if (!writeFlag) {
                console.log("File not found: " + path.fullname);
                return null;
            }
            contents = new Uint8Array();
            entry = Squeak.filePut(path.fullname, contents.buffer);
            if (!entry) {
                console.log("Cannot create file: " + path.fullname);
                return null;
            }
        }
        // make the file object
        var file = {
            name: path.fullname,
            size: entry[4],         // actual file size, may differ from contents.length
            contents: contents,     // possibly null, fetched when needed
            modified: false,
            refCount: 1
        };
        SqueakFiles[file.name] = file;
        return file;
    },
    fileClose: function(file) {
        Squeak.flushFile(file);
        if (--file.refCount == 0)
            delete SqueakFiles[file.name];
    },
    fileContentsDo: function(file, func) {
        if (file.contents) {
            func(file);
        } else {
            if (file.contents === false) // failed to get contents before
                return false;
            var unfreeze = this.vm.freeze();
            Squeak.fileGet(file.name,
                function success(contents){
                    file.contents = this.asUint8Array(contents);
                    unfreeze();
                    func(file);
                }.bind(this),
                function error(msg) {
                    console.log("File get failed: " + msg);
                    file.contents = false;
                    unfreeze();
                    func(file);
                }.bind(this));
        }
        return true;
    },
},
'SoundPlugin', {
    snd_primitiveSoundStart: function(argCount) {
        return this.snd_primitiveSoundStartWithSemaphore(argCount);
    },
    snd_primitiveSoundStartWithSemaphore: function(argCount) {
        var bufFrames = this.stackInteger(argCount-1),
            samplesPerSec = this.stackInteger(argCount-2),
            stereoFlag = this.stackBoolean(argCount-3),
            semaIndex = argCount > 3 ? this.stackInteger(argCount-4) : 0;
        if (!this.success) return false;
        this.audioContext = Squeak.startAudioOut();
        if (!this.audioContext) {
            this.vm.warnOnce("could not initialize audio");
            return false;
        }
        this.audioContext.sampleRate = samplesPerSec;
        this.audioSema = semaIndex; // signal when ready to accept another buffer of samples
        this.audioNextTimeSlot = 0;
        this.audioBuffersReady = [];
        this.audioBuffersUnused = [
            this.audioContext.createBuffer(stereoFlag ? 2 : 1, bufFrames, samplesPerSec),
            this.audioContext.createBuffer(stereoFlag ? 2 : 1, bufFrames, samplesPerSec),
        ];
        console.log("sound: started");
        return this.popNIfOK(argCount);
    },
    snd_playNextBuffer: function() {
        if (!this.audioContext || this.audioBuffersReady.length === 0)
            return;
        var source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffersReady.shift();
        source.connect(this.audioContext.destination);
        if (this.audioNextTimeSlot < this.audioContext.currentTime) {
            if (this.audioNextTimeSlot > 0)
                console.warn("sound " + this.audioContext.currentTime.toFixed(3) + 
                    ": buffer underrun by " + (this.audioContext.currentTime - this.audioNextTimeSlot).toFixed(3) + " s");
            this.audioNextTimeSlot = this.audioContext.currentTime;
        }
        source.start(this.audioNextTimeSlot);
        //console.log("sound " + this.audioContext.currentTime.toFixed(3) + 
        //    ": scheduling from " + this.audioNextTimeSlot.toFixed(3) + 
        //    " to " + (this.audioNextTimeSlot + source.buffer.duration).toFixed(3));
        this.audioNextTimeSlot += source.buffer.duration;
        // source.onended is unreliable, using a timeout instead
        window.setTimeout(function() {
            if (!this.audioContext) return;
            // console.log("sound " + this.audioContext.currentTime.toFixed(3) + 
            //    ": done, next time slot " + this.audioNextTimeSlot.toFixed(3));
            this.audioBuffersUnused.push(source.buffer);
            if (this.audioSema) this.signalSemaphoreWithIndex(this.audioSema);
            this.vm.forceInterruptCheck();
        }.bind(this), (this.audioNextTimeSlot - this.audioContext.currentTime) * 1000);
        this.snd_playNextBuffer();
    },
    snd_primitiveSoundAvailableSpace: function(argCount) {
        if (!this.audioContext) {
            console.log("sound: no audio context");
            return false;
        }
        var available = 0;
        if (this.audioBuffersUnused.length > 0) {
            var buf = this.audioBuffersUnused[0];
            available = buf.length * buf.numberOfChannels * 2;
        }
        return this.popNandPushIfOK(argCount + 1, available);
    },
    snd_primitiveSoundPlaySamples: function(argCount) {
        if (!this.audioContext || this.audioBuffersUnused.length === 0) {
            console.log("sound: play but no free buffers");
            return false;
        }
        var count = this.stackInteger(2),
            sqSamples = this.stackNonInteger(1).wordsAsInt16Array(),
            startIndex = this.stackInteger(0) - 1;
        if (!this.success || !sqSamples) return false;
        var buffer = this.audioBuffersUnused.shift(),
            channels = buffer.numberOfChannels;
        for (var channel = 0; channel < channels; channel++) {
            var jsSamples = buffer.getChannelData(channel),
                index = startIndex + channel;
            for (var i = 0; i < count; i++) {
                jsSamples[i] = sqSamples[index] / 32768;    // int16 -> float32
                index += channels;
            }
        }
        this.audioBuffersReady.push(buffer);
        this.snd_playNextBuffer();
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundPlaySilence: function(argCount) {
        if (!this.audioContext || this.audioBuffersUnused.length === 0) {
            console.log("sound: play but no free buffers");
            return false;
        }
        var buffer = this.audioBuffersUnused.shift(),
            channels = buffer.numberOfChannels,
            count = buffer.length;
        for (var channel = 0; channel < channels; channel++) {
            var jsSamples = buffer.getChannelData(channel);
            for (var i = 0; i < count; i++)
                jsSamples[i] = 0;
        }
        this.audioBuffersReady.push(buffer);
        this.snd_playNextBuffer();
        return this.popNandPushIfOK(argCount + 1, count);
    },
    snd_primitiveSoundStop: function(argCount) {
        if (this.audioContext) {
            this.audioContext = null;
            this.audioBuffersReady = null;
            this.audioBuffersUnused = null;
            this.audioNextTimeSlot = 0;
            this.audioSema = 0;
            console.log("sound: stopped");
        }
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundStartRecording: function(argCount) {
        if (argCount !== 3) return false;
        var rcvr = this.stackNonInteger(3),
            samplesPerSec = this.stackInteger(2),
            stereoFlag = this.stackBoolean(1),
            semaIndex = this.stackInteger(0);
        if (!this.success) return false;
        var method = this.primMethod,
            unfreeze = this.vm.freeze(),
            self = this;
        Squeak.startAudioIn(
            function onSuccess(audioContext, source) {
                console.log("sound: recording started")
                self.audioInContext = audioContext;
                self.audioInSource = source;
                self.audioInSema = semaIndex;
                self.audioInBuffers = [];
                self.audioInBufferIndex = 0;
                // try to set sampling rate
                self.audioInContext.sampleRate = samplesPerSec;
                self.audioInOverSample = 1;
                // if sample rate is still too high, adjust oversampling
                while (samplesPerSec * self.audioInOverSample < self.audioInContext.sampleRate)
                    self.audioInOverSample *= 2;
                // make a buffer of at least 100 ms
                var bufferSize = self.audioInOverSample * 1024;
                while (bufferSize / self.audioInContext.sampleRate < 0.1)
                    bufferSize *= 2;
                self.audioInProcessor = audioContext.createScriptProcessor(bufferSize, stereoFlag ? 2 : 1, stereoFlag ? 2 : 1);
                self.audioInProcessor.onaudioprocess = function(event) {
                    self.snd_recordNextBuffer(event.inputBuffer);
                };
                self.audioInSource.connect(self.audioInProcessor);
                self.audioInProcessor.connect(audioContext.destination);
                self.vm.popN(argCount);
                window.setTimeout(unfreeze, 0);
            },
            function onError(msg) {
                console.warn(msg);
                self.vm.sendAsPrimitiveFailure(rcvr, method, argCount);
                window.setTimeout(unfreeze, 0);
            });
        return true;
    },
    snd_recordNextBuffer: function(audioBuffer) {
        if (!this.audioInContext) return;
        // console.log("sound " + this.audioInContext.currentTime.toFixed(3) +
        //    ": recorded " + audioBuffer.duration.toFixed(3) + " s");
        if (this.audioInBuffers.length > 5)
            this.audioInBuffers.shift();
        this.audioInBuffers.push(audioBuffer);
        if (this.audioInSema) this.signalSemaphoreWithIndex(this.audioInSema);
        this.vm.forceInterruptCheck();
    },
    snd_primitiveSoundGetRecordingSampleRate: function(argCount) {
       if (!this.audioInContext) return false;
       var actualRate = this.audioInContext.sampleRate / this.audioInOverSample | 0;
       console.log("sound: actual recording rate " + actualRate + "x" + this.audioInOverSample);
       return this.popNandPushIfOK(argCount + 1, actualRate);
    },
    snd_primitiveSoundRecordSamples: function(argCount) {
        var sqSamples = this.stackNonInteger(1).wordsAsInt16Array(),
            sqStartIndex = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var sampleCount = 0;
        while (sqStartIndex < sqSamples.length) {
            if (this.audioInBuffers.length === 0) break;
            var buffer = this.audioInBuffers[0],
                channels = buffer.numberOfChannels,
                sqStep = channels,
                jsStep = this.audioInOverSample,
                sqCount = (sqSamples.length - sqStartIndex) / sqStep,
                jsCount = (buffer.length - this.audioInBufferIndex) / jsStep,
                count = Math.min(jsCount, sqCount);
            for (var channel = 0; channel < channels; channel++) {
                var jsSamples = buffer.getChannelData(channel),
                    jsIndex = this.audioInBufferIndex,
                    sqIndex = sqStartIndex + channel;
                for (var i = 0; i < count; i++) {
                    sqSamples[sqIndex] = jsSamples[jsIndex] * 32768 & 0xFFFF; // float32 -> int16
                    sqIndex += sqStep;
                    jsIndex += jsStep;
                }
            }
            sampleCount += count * channels;
            sqStartIndex += count * channels;
            if (jsIndex < buffer.length) {
                this.audioInBufferIndex = jsIndex;
            } else {
                this.audioInBufferIndex = 0;
                this.audioInBuffers.shift();
            }
        }
        return this.popNandPushIfOK(argCount + 1, sampleCount);
    },
    snd_primitiveSoundStopRecording: function(argCount) {
        if (this.audioInContext) {
            this.audioInSource.disconnect();
            this.audioInProcessor.disconnect();
            this.audioInContext = null;
            this.audioInSema = 0;
            this.audioInBuffers = null;
            this.audioInSource = null;
            this.audioInProcessor = null;
            console.log("sound recording stopped")
        }
        return true;
    },
    snd_primitiveSoundSetRecordLevel: function(argCount) {
        return true;
    },
},
'B2DPlugin', {
    geInitialiseModule: function() {
        this.b2d_debug = false;
        this.b2d_state = {
            form: null,
        };
    },
    geReset: function(bitbltObj) {
        if (this.b2d_debug) console.log("-- reset");
        var state = this.b2d_state,
            formObj = bitbltObj.pointers[Squeak.BitBlt_dest];
        if (!state.form || state.form.obj !== formObj)
            state.form = this.loadForm(formObj);
        this.geSetupCanvas();
        state.didRender = false;
        state.needsFlush = false;
        state.hasFill = false;
        state.hasStroke = false;
        state.fills = [];
        state.minX = 0;
        state.minY = 0;
        state.maxX = state.form.width;
        state.maxY = state.form.height;
    },
    geSetupCanvas: function() {
        var state = this.b2d_state;
        // create canvas and drawing context
        if (!state.context) {
            var canvas = document.getElementById("SqueakB2DCanvas");
            if (!canvas) {
                canvas = document.createElement("canvas");
                canvas.id = "SqueakB2DCanvas";
                canvas.setAttribute("style", "position:fixed;top:20px;left:950px;background:rgba(255,255,255,0.5)");
                document.body.appendChild(canvas);
            }
            state.context = canvas.getContext("2d");
            if (!state.context) alert("B2D: cannot create context");
        };
        // set canvas size, which also clears it
        var form = state.form,
            canvas = state.context.canvas;
        canvas.width = form.width;
        canvas.height = form.height;
        canvas.style.visibility = this.b2d_debug ? "visible" : "hidden";
    },
    geFlush: function() {
        if (this.b2d_debug) console.log("-- flush");
        var state = this.b2d_state;
        // fill and stroke path
        if (state.hasFill) {
            state.context.closePath();
            state.context.fill();
            state.didRender = true;
            if (this.b2d_debug) console.log("==> filling");
        }
        if (state.hasStroke) {
            state.context.stroke();
            state.didRender = true;
            if (this.b2d_debug) console.log("==> stroking");
        }
        // if (this.b2d_debug) this.vm.breakNow("b2d_debug");
        state.context.beginPath();
        state.flushNeeded = false;
    },
    geRender: function() {
        if (this.b2d_debug) console.log("-- render");
        var state = this.b2d_state;
        if (state.flushNeeded) this.geFlush();
        if (state.didRender) this.geBlendOverForm();
        return 0; // answer stop reason
    },
    geBlendOverForm: function() {
        var state = this.b2d_state,
            form = state.form;
        if (this.b2d_debug) console.log("==> read into " + form.width + "x" + form.height + "@" + form.depth);
        if (!form.width || !form.height || state.maxX <= state.minX || state.maxY <= state.minY) return;
        if (!form.msb) return this.vm.warnOnce("B2D: drawing to little-endian forms not implemented yet");
        if (form.depth == 32) {
            this.geBlendOverForm32();
        } else if (form.depth == 16) {
            this.geBlendOverForm16();
        } else if (form.depth == 8) {
            this.geBlendOverForm8();
        } else if (form.depth == 1) {
            this.geBlendOverForm1();
        } else {
            this.vm.warnOnce("B2D: drawing to " + form.depth + " bit forms not supported yet");
        }
        this.displayDirty(form.obj, {left: state.minX, top: state.minY, right: state.maxX, bottom: state.maxY});
    },
    geBlendOverForm1: function() {
        // since we have 32 pixels per word, round to 32 pixels
        var state = this.b2d_state,
            form = state.form,
            minX = state.minX & ~31,
            minY = state.minY,
            maxX = (state.maxX + 31) & ~31,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> clipped to " + width + "x" + height);
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + (minX / 32);
            for (var x = minX; x < maxX; x += 32*4) {
                var dstPixels = form.bits[dstIndex],  // 32 one-bit pixels
                    dstShift = 31,
                    result = 0;
                for (var i = 0; i < 32; i++) {
                    var alpha = canvasBytes[srcIndex+3],
                        pix = alpha > 0.5 ? 0 : dstPixels;  // assume we're drawing in black 
                    result = result | (pix & (1 << dstShift));
                    dstShift--;
                    srcIndex += 4;
                }
                form.bits[dstIndex] = result;
                dstIndex++;
            }
        }
    },
    geBlendOverForm8: function() {
        // since we have four pixels per word, round to 4 pixels
        var state = this.b2d_state,
            form = state.form,
            minX = state.minX & ~3,
            minY = state.minY,
            maxX = (state.maxX + 3) & ~3,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> clipped to " + width + "x" + height);
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + (minX / 4);
            for (var x = minX; x < maxX; x += 4) {
                if (!(canvasBytes[srcIndex+3] | canvasBytes[srcIndex+7] | canvasBytes[srcIndex+11] | canvasBytes[srcIndex+15])) {
                    srcIndex += 16; dstIndex++; // skip pixels if fully transparent
                    continue;
                }
                var dstPixels = form.bits[dstIndex],  // four 8-bit pixels
                    dstShift = 24,
                    result = 0;
                for (var i = 0; i < 4; i++) {
                    var alpha = canvasBytes[srcIndex+3] / 255;
                    if (alpha < 0.1) {
                        result = result | (dstPixels & (0xFF << dstShift)); // keep dst
                    } else {
                        var oneMinusAlpha = 1 - alpha,
                            pix = this.indexedColors[(dstPixels >> dstShift) & 0xFF],
                            r = alpha * canvasBytes[srcIndex  ] + oneMinusAlpha * ((pix >> 16) & 0xFF),
                            g = alpha * canvasBytes[srcIndex+1] + oneMinusAlpha * ((pix >>  8) & 0xFF),
                            b = alpha * canvasBytes[srcIndex+2] + oneMinusAlpha * ( pix        & 0xFF),
                            res = 40 + (r / 255 * 5.5|0) * 36 + (b / 255 * 5.5|0) * 6 + (g / 255 * 5.5|0);  // 6x6x6 RGB cube
                        result = result | (res << dstShift);
                    }
                    dstShift -= 8;
                    srcIndex += 4;
                }
                form.bits[dstIndex] = result;
                dstIndex++;
            }
        }
    },
    geBlendOverForm16: function() {
        // since we have two pixels per word, grab from even positions
        var state = this.b2d_state,
            form = state.form,
            minX = state.minX & ~1,
            minY = state.minY,
            maxX = (state.maxX + 1) & ~1,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> clipped to " + width + "x" + height);
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + (minX / 2);
            for (var x = minX; x < maxX; x += 2) {
                if (!(canvasBytes[srcIndex+3] | canvasBytes[srcIndex+7])) {
                    srcIndex += 8; dstIndex++; // skip pixels if fully transparent
                    continue;
                }
                var dstPixels = form.bits[dstIndex],  // two 16-bit pixels
                    dstShift = 16,
                    result = 0;
                for (var i = 0; i < 2; i++) {
                    var alpha = canvasBytes[srcIndex+3] / 255,
                        oneMinusAlpha = 1 - alpha,
                        pix = dstPixels >> dstShift,
                        r = alpha * canvasBytes[srcIndex  ] + oneMinusAlpha * ((pix >> 7) & 0xF8),
                        g = alpha * canvasBytes[srcIndex+1] + oneMinusAlpha * ((pix >> 2) & 0xF8),
                        b = alpha * canvasBytes[srcIndex+2] + oneMinusAlpha * ((pix << 3) & 0xF8),
                        res = (r & 0xF8) << 7 | (g & 0xF8) << 2 | (b & 0xF8) >> 3;  
                    result = result | (res << dstShift);
                    dstShift -= 16;
                    srcIndex += 4;
                }
                form.bits[dstIndex] = result;
                dstIndex++;
            }
        }
    },
    geBlendOverForm32: function() {
        var state = this.b2d_state,
            minX = state.minX,
            minY = state.minY,
            maxX = state.maxX,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            form = state.form,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> reading " + width + "x" + height + " pixels");
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + minX;
            for (var x = minX; x < maxX; x++) {
                var srcAlpha = canvasBytes[srcIndex+3];
                if (srcAlpha !== 0) { // skip pixel if fully transparent
                    var alpha = srcAlpha / 255,
                        oneMinusAlpha = 1 - alpha,
                        pix = form.bits[dstIndex],
                        a =                        srcAlpha + oneMinusAlpha * ((pix >> 24) & 0xFF),
                        r = alpha * canvasBytes[srcIndex  ] + oneMinusAlpha * ((pix >> 16) & 0xFF),
                        g = alpha * canvasBytes[srcIndex+1] + oneMinusAlpha * ((pix >>  8) & 0xFF),
                        b = alpha * canvasBytes[srcIndex+2] + oneMinusAlpha * ( pix        & 0xFF);
                    form.bits[dstIndex] = (a << 24) | (r << 16) | (g << 8) | b;
                }
                srcIndex+= 4;
                dstIndex++;
            }
        }
    },
    gePointsFrom: function(arrayObj, nPoints) {
        var words = arrayObj.words;
        if (words) {
            if (words.length == nPoints) return arrayObj.wordsAsInt16Array();       // ShortPointArray
            if (words.length == nPoints * 2) return arrayObj.wordsAsInt32Array();   // PointArray
            return null;
        }
        // Array of Points
        var points = arrayObj.pointers;
        if (!points || points.length != nPoints)
            return null;
        var array = [];
        for (var i = 0; i < nPoints; i++) {
            var p = points[i].pointers;         // Point
            array.push(this.floatOrInt(p[0]));  // x
            array.push(this.floatOrInt(p[1]));  // y
        }
        return array;
    },
    geSetClip: function(minX, minY, maxX, maxY) {
        if (this.b2d_debug) console.log("==> clip " + minX + "," + minY + "," + maxX + "," + maxY);
        var state = this.b2d_state;
        if (state.minX < minX) state.minX = minX;
        if (state.minY < minY) state.minY = minY;
        if (state.maxX > maxX) state.maxX = maxX;
        if (state.maxY > maxY) state.maxY = maxY;
    },
    geSetOffset: function(x, y) {
        // TODO: make offset work together with transform
        this.b2d_state.context.setTransform(1, 0, 0, 1, x, y);
        if (this.b2d_debug) console.log("==> translate " + x +"," + y);
    },
    geSetTransform: function(t) {
        /* Transform is a matrix:
                ⎛a₁₁ a₁₂ a₁₃⎞
                ⎝a₂₁ a₂₂ a₂₃⎠
            Squeak Matrix2x3Transform stores as
                [a₁₁, a₁₂, a₁₃, a₂₁, a₂₂, a₂₃]
            but canvas expects
                [a₁₁, a₂₁, a₁₂, a₂₂, a₁₃, a₂₃]
        */
        this.b2d_state.context.setTransform(t[0], t[3], t[1], t[4], t[2], t[5]);
        if (this.b2d_debug) console.log("==> transform: " + [t[0], t[3], t[1], t[4], t[2], t[5]].join(','));
    },
    geSetStyle: function(fillIndex, borderIndex, borderWidth) {
        var hasFill = fillIndex !== 0,
            hasStroke = borderIndex !== 0 && borderWidth > 0,
            state = this.b2d_state;
        state.hasFill = hasFill;
        state.hasStroke = hasStroke;
        if (hasFill) {
            state.context.fillStyle = this.geStyleFrom(fillIndex);
            if (this.b2d_debug) console.log("==> fill style: " + state.context.fillStyle);
        }
        if (hasStroke) {
            state.context.strokeStyle = this.geStyleFrom(borderIndex);
            state.context.lineWidth = borderWidth;
            if (this.b2d_debug) console.log("==> stroke style: " + state.context.strokeStyle + '@' + borderWidth);
        }
        return hasFill || hasStroke;
    },
    geColorFrom: function(word) {
        var b = word & 0xFF,
            g = (word & 0xFF00) >>> 8,
            r = (word & 0xFF0000) >>> 16,
            a = ((word & 0xFF000000) >>> 24) / 255;
        if (a > 0) { // undo pre-multiplication of alpha
            b = b / a & 0xFF;
            g = g / a & 0xFF;
            r = r / a & 0xFF;
        }        
        return "rgba(" + [r, g, b, a].join(",") + ")";
    },
    geStyleFrom: function(index) {
        if (index === 0) return null;
        var fills = this.b2d_state.fills;
        if (index <= fills.length) return fills[index - 1];
        return this.geColorFrom(index);
    },
    gePrimitiveSetEdgeTransform: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveSetEdgeTransform");
        var transform = this.stackNonInteger(0);
        if (!this.success) return false;
        if (transform.words) this.geSetTransform(transform.wordsAsFloat32Array());
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveSetClipRect: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveSetClipRect");
        var rect = this.stackNonInteger(0);
        if (!this.success) return false;
        var origin = rect.pointers[0].pointers,
            corner = rect.pointers[1].pointers;
        this.geSetClip(origin[0], origin[1], corner[0], corner[1]);
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveRenderImage: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveRenderImage");
        var stopReason = this.geRender();
        this.vm.popNandPush(argCount + 1, stopReason);
        return true;
    },
    gePrimitiveRenderScanline: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveRenderScanline");
        var stopReason = this.geRender();
        this.vm.popNandPush(argCount + 1, stopReason);
        return true;
    },
    gePrimitiveFinishedProcessing: function(argCount) {
        var finished = !this.b2d_state.flushNeeded;
        if (this.b2d_debug) console.log("b2d: gePrimitiveFinishedProcessing => " + finished);
        this.vm.popNandPush(argCount+1, this.makeStObject(finished));
        return true;
    },
    gePrimitiveNeedsFlushPut: function(argCount) {
        var needsFlush = this.stackBoolean(0);
        if (!this.success) return false;
        this.b2d_state.needsFlush = needsFlush;
        if (this.b2d_debug) console.log("b2d: gePrimitiveNeedsFlushPut: " + needsFlush);
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveInitializeBuffer: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveInitializeBuffer");
        var engine = this.stackNonInteger(argCount),
            bitblt = engine.pointers[2]; // BEBitBltIndex
        this.geReset(bitblt);
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddOval: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddOval");
        var origin      = this.stackNonInteger(4).pointers,
            corner      = this.stackNonInteger(3).pointers,
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var ctx = this.b2d_state.context,
                x = this.floatOrInt(origin[0]),
                y = this.floatOrInt(origin[1]),
                w = this.floatOrInt(corner[0]) - x,
                h = this.floatOrInt(corner[1]) - y;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(w, h);
            ctx.arc(0.5, 0.5, 0.5, 0, Math.PI * 2);
            ctx.restore();
            if (this.b2d_debug) console.log("==> oval " + [x, y, w, h].join(','));
            this.b2d_state.flushNeeded = true;
        }
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddBezierShape: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddBezierShape");
        var points      = this.stackNonInteger(4),
            nSegments   = this.stackInteger(3),
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var p = this.gePointsFrom(points, nSegments * 3);
            if (!p) return false;
            var ctx = this.b2d_state.context;
            ctx.moveTo(p[0], p[1]);
            for (var i = 0; i < p.length; i += 6)
                ctx.quadraticCurveTo(p[i+2], p[i+3], p[i+4], p[i+5]);
            if (this.b2d_debug) console.log("==> beziershape");
            this.b2d_state.flushNeeded = true;
        }
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddPolygon: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddPolygon");
        var points      = this.stackNonInteger(4),
            nPoints     = this.stackInteger(3),
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var p = this.gePointsFrom(points, nPoints);
            if (!p) return false;
            var ctx = this.b2d_state.context;
            ctx.moveTo(p[0], p[1]);
            for (var i = 2; i < p.length; i += 2)
                ctx.lineTo(p[i], p[i+1]);
            if (this.b2d_debug) console.log("==> polygon");
            this.b2d_state.flushNeeded = true;
        }
        return true;
    },
    gePrimitiveAddRect: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddRect");
        var origin      = this.stackNonInteger(4).pointers,
            corner      = this.stackNonInteger(3).pointers,
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var x = this.floatOrInt(origin[0]),
                y = this.floatOrInt(origin[1]),
                w = this.floatOrInt(corner[0]) - x,
                h = this.floatOrInt(corner[1]) - y; 
            this.b2d_state.context.rect(x, y, w, h);
            if (this.b2d_debug) console.log("==> rect " + [x, y, w, h].join(','));
            this.b2d_state.flushNeeded = true;
        }
        this.vm.popNandPush(argCount+1, 0);
        return true;
    },
    gePrimitiveAddBezier: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddBezier");
        this.vm.warnOnce("B2D: beziers not implemented yet");
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddCompressedShape: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddCompressedShape");
        var points = this.stackNonInteger(6),
            nSegments = this.stackInteger(5),
            leftFills = this.stackNonInteger(4).wordsAsInt16Array(),
            rightFills = this.stackNonInteger(3).wordsAsInt16Array(),
            lineWidths = this.stackNonInteger(2).wordsAsInt16Array(),
            lineFills = this.stackNonInteger(1).wordsAsInt16Array(),
            fillIndexList = this.stackNonInteger(0).words;
        if (!this.success) return false;
        // fills and widths are ShortRunArrays
        if (leftFills.length !== 2 || rightFills.length !== 2 || lineWidths.length !== 2 || lineFills.length !== 2 ||
            leftFills[1] !== nSegments || rightFills[1] !== nSegments || lineWidths[1] !== nSegments || lineFills[1] !== nSegments ||
            leftFills[0] !== 0) {
            this.vm.warnOnce("B2D: complex compressed shapes not implemented yet");
            debugger;
        }
        var fillIndex = rightFills[0] ? fillIndexList[rightFills[0] - 1] : 0,
            borderIndex = lineFills[0] ? fillIndexList[lineFills[0] - 1] : 0,
            borderWidth = lineWidths[0];
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var p = this.gePointsFrom(points, nSegments * 3);
            if (!p) return false;
            var ctx = this.b2d_state.context;
            ctx.moveTo(p[0], p[1]);
            for (var i = 0; i < p.length; i += 6)
                ctx.quadraticCurveTo(p[i+2], p[i+3], p[i+4], p[i+5]);
            if (this.b2d_debug) console.log("==> beziershape");
            this.geFlush();
        }
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddLine: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddLine");
        this.vm.warnOnce("B2D: lines not implemented yet");
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddBitmapFill: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddBitmapFill");
        this.vm.warnOnce("B2D: bitmap fills not implemented yet");
        var fills = this.b2d_state.fills;
        fills.push('red');
        this.vm.popNandPush(argCount+1, fills.length);
        return true;
    },
    gePrimitiveAddGradientFill: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddGradientFill");
        var ramp = this.stackNonInteger(4).words,
            origin = this.stackNonInteger(3).pointers,
            direction = this.stackNonInteger(2).pointers,
            //normal = this.stackNonInteger(1).pointers,
            isRadial = this.stackBoolean(0);
        if (!this.success) return false;
        var x = this.floatOrInt(origin[0]),
            y = this.floatOrInt(origin[1]),
            dx = this.floatOrInt(direction[0]),
            dy = this.floatOrInt(direction[1]),
            state = this.b2d_state,
            ctx = state.context,
            gradient = isRadial
                ? ctx.createRadialGradient(x, y, 0, x, y, Math.sqrt(dx*dx + dy*dy))
                : ctx.createLinearGradient(x, y, x + dx, y + dy);
        // we get a 512-step color ramp here. Going to assume it's made from only two colors.
        gradient.addColorStop(0, this.geColorFrom(ramp[0]));
        gradient.addColorStop(1, this.geColorFrom(ramp[ramp.length - 1]));
        // TODO: use more than two stops
        // IDEA: the original gradient is likely in a temp at this.vm.stackValue(7)
        //       so we could get the original color stops from it
        state.fills.push(gradient);
        this.vm.popNandPush(argCount+1, state.fills.length);
        return true;
    },
    gePrimitiveNeedsFlush: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveNeedsFlush => " + this.b2d_state.needsFlush);
        this.vm.popNandPush(argCount, this.makeStObject(this.b2d_state.needsFlush));
        return true;
    },
    gePrimitiveSetOffset: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveSetOffset");
        var offset = this.stackNonInteger(0).pointers;
        if (!offset) return false;
        this.geSetOffset(this.floatOrInt(offset[0]), this.floatOrInt(offset[1]));
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveGetFailureReason: function(argCount) { this.vm.popN(argCount+1, 0); return true; },
    gePrimitiveSetColorTransform: function(argCount) {this.vm.popN(argCount); return true;},
    gePrimitiveSetAALevel: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetAALevel: function(argCount) { return false; },
    gePrimitiveSetDepth: function(argCount) {this.vm.popN(argCount); return true; },
    gePrimitiveGetDepth: function(argCount) {this.vm.popNandPush(argCount+1, 0); return true; },
    gePrimitiveGetClipRect: function(argCount) { return false; },
    gePrimitiveGetOffset: function(argCount) { return false; },
    gePrimitiveSetBitBltPlugin: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveDoProfileStats: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetBezierStats: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetCounts: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetTimes: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveInitializeProcessing: function(argCount) { return false; },
    gePrimitiveAddActiveEdgeEntry: function(argCount) { return false; },
    gePrimitiveChangedActiveEdgeEntry: function(argCount) { return false; },
    gePrimitiveNextActiveEdgeEntry: function(argCount) { return false; },
    gePrimitiveNextGlobalEdgeEntry: function(argCount) { return false; },
    gePrimitiveDisplaySpanBuffer: function(argCount) { return false; },
    gePrimitiveCopyBuffer: function(argCount) { return false; },
    gePrimitiveNextFillEntry: function(argCount) { return false; },
    gePrimitiveMergeFillFrom: function(argCount) { return false; },
    gePrimitiveRegisterExternalEdge: function(argCount) { return false; },
    gePrimitiveRegisterExternalFill: function(argCount) { return false; },
},
'JPEGReadWriter2Plugin', {
    jpeg2_primJPEGPluginIsPresent: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.vm.trueObj);
    },
    jpeg2_primImageHeight: function(argCount) {
        var decompressStruct = this.stackNonInteger(0).wordsOrBytes();
        if (!decompressStruct) return false;
        var height = decompressStruct[1];
        return this.popNandPushIfOK(argCount + 1, height);
    },
    jpeg2_primImageWidth: function(argCount) {
        var decompressStruct = this.stackNonInteger(0).wordsOrBytes();
        if (!decompressStruct) return false;
        var width = decompressStruct[0];
        return this.popNandPushIfOK(argCount + 1, width);
    },
    jpeg2_primJPEGCompressStructSize: function(argCount) {
        // no struct needed
        return this.popNandPushIfOK(argCount + 1, 0);
    },
    jpeg2_primJPEGDecompressStructSize: function(argCount) {
        // width, height, 32 bits each
        return this.popNandPushIfOK(argCount + 1, 8);
    },
    jpeg2_primJPEGErrorMgr2StructSize: function(argCount) {
        // no struct needed
        return this.popNandPushIfOK(argCount + 1, 0);
    },
    jpeg2_primJPEGReadHeaderfromByteArrayerrorMgr: function(argCount) {
        var decompressStruct = this.stackNonInteger(2).wordsOrBytes(),
            source = this.stackNonInteger(1).bytes;
        if (!decompressStruct || !source) return false;
        var unfreeze = this.vm.freeze();
        this.jpeg2_readImageFromBytes(source,
            function success(image) {
                this.jpeg2state = {src: source, img: image};
                decompressStruct[0] = image.width;
                decompressStruct[1] = image.height;
                unfreeze();
            }.bind(this),
            function error() {
                decompressStruct[0] = 0;
                decompressStruct[1] = 0;
                unfreeze();
            }.bind(this));
        return this.popNIfOK(argCount);
    },
    jpeg2_primJPEGReadImagefromByteArrayonFormdoDitheringerrorMgr: function(argCount) {
        var source = this.stackNonInteger(3).bytes,
            form = this.stackNonInteger(2).pointers,
            ditherFlag = this.stackBoolean(1);
        if (!this.success || !source || !form) return false;
        var state = this.jpeg2state;
        if (!state || state.src !== source) {
            console.error("jpeg read did not match header info");
            return false;
        }
        var depth = form[Squeak.Form_depth],
            image = this.jpeg2_getPixelsFromImage(state.img),
            formBits = form[Squeak.Form_bits].words;
        if (depth === 32) {
            this.jpeg2_copyPixelsToForm32(image, formBits);
        } else if (depth === 16) {
            if (ditherFlag) this.jpeg2_ditherPixelsToForm16(image, formBits);
            else this.jpeg2_copyPixelsToForm16(image, formBits);
        } else return false;
        return this.popNIfOK(argCount);
    },
    jpeg2_primJPEGWriteImageonByteArrayformqualityprogressiveJPEGerrorMgr: function(argCount) {
        this.vm.warnOnce("JPEGReadWritePlugin2: writing not implemented yet");
        return false;
    },
    jpeg2_readImageFromBytes: function(bytes, thenDo, errorDo) {
        var blob = new Blob([bytes], {type: "image/jpeg"}),
            image = new Image();
        image.onload = function() {
            thenDo(image);
        };
        image.onerror = function() {
            console.warn("could not render JPEG");
            errorDo();
        };
        image.src = (window.URL || window.webkitURL).createObjectURL(blob);
    },
    jpeg2_getPixelsFromImage: function(image) {
        var canvas = document.createElement("canvas"),
            context = canvas.getContext("2d");
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
    },
    jpeg2_copyPixelsToForm32: function(image, formBits) {
        var pixels = image.data;
        for (var i = 0; i < formBits.length; i++) {
            var r = pixels[i*4 + 0],
                g = pixels[i*4 + 1],
                b = pixels[i*4 + 2];
            formBits[i] = 0xFF000000 | (r << 16) | (g << 8) | b;
        }
    },
    jpeg2_copyPixelsToForm16: function(image, formBits) {
        var width = image.width,
            height = image.height,
            pixels = image.data;
        for (var y = 0; y < height; y++)    
            for (var x = 0; x < width; x += 2) {
                var i = y * height + x,
                    r1 = pixels[i*4 + 0] >> 3,
                    g1 = pixels[i*4 + 1] >> 3,
                    b1 = pixels[i*4 + 2] >> 3,
                    r2 = pixels[i*4 + 4] >> 3,
                    g2 = pixels[i*4 + 5] >> 3,
                    b2 = pixels[i*4 + 6] >> 3,
                    formPix = (r1 << 10) | (g1 << 5) | b1;
                if (formPix === 0) formPix = 1;
                formPix = (formPix << 16) | (r2 << 10) | (g2 << 5) | b2;
                if ((formPix & 65535) === 0) formPix = formPix | 1;
                formBits[i >> 1] = formPix;
            }
    },
    jpeg2_ditherPixelsToForm16: function(image, formBits) {
        var width = image.width >> 1,   // 2 pix a time
            height = image.height,
            pixels = image.data,
            ditherMatrix1 = [2, 0, 14, 12, 1, 3, 13, 15],
			ditherMatrix2 = [10, 8, 6, 4, 9, 11, 5, 7];
        for (var y = 0; y < height; y++)    
            for (var x = 0; x < width; x++) {
                var i = (y * height + 2 * x) << 2,
                    r1 = pixels[i + 0],
                    g1 = pixels[i + 1],
                    b1 = pixels[i + 2],
                    r2 = pixels[i + 4],
                    g2 = pixels[i + 5],
                    b2 = pixels[i + 6];
                /* Do 4x4 ordered dithering. Taken from Form>>orderedDither32To16 */
                var v = ((y & 3) << 1) | (x & 1),
                    dmv1 = ditherMatrix1[v],
                    dmv2 = ditherMatrix2[v],
                    di, dmi, dmo;
                di = (r1 * 496) >> 8, dmi = di & 15, dmo = di >> 4;
                if (dmv1 < dmi) { r1 = dmo+1; } else { r1 = dmo; };
                di = (g1 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv1 < dmi) { g1 = dmo+1; } else { g1 = dmo; };
                di = (b1 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv1 < dmi) { b1 = dmo+1; } else { b1 = dmo; };
                
                di = (r2 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv2 < dmi) { r2 = dmo+1; } else { r2 = dmo; };
                di = (g2 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv2 < dmi) { g2 = dmo+1; } else { g2 = dmo; };
                di = (b2 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv2 < dmi) { b2 = dmo+1; } else { b2 = dmo; };

                var formPix = (r1 << 10) | (g1 << 5) | b1;
                if (formPix === 0) formPix = 1;
                formPix = (formPix << 16) | (r2 << 10) | (g2 << 5) | b2;
                if ((formPix & 65535) === 0) formPix = formPix | 1;
                formBits[i >> 3] = formPix;
            }
    },
},
'ScratchPluginAdditions', {
    // methods not handled by generated ScratchPlugin
    scratch_primitiveOpenURL: function(argCount) {
        var url = this.stackNonInteger(0).bytesAsString();
        if (url == "") return false;
        if (/^\/SqueakJS\//.test(url)) {
            url = url.slice(10);     // remove file root
            var path = Squeak.splitFilePath(url),
                template = localStorage["squeak-template:" + path.dirname];
            if (template) url = JSON.parse(template).url + "/" + path.basename;
        }
        window.open(url, "_blank"); // likely blocked as pop-up, but what can we do?
        return this.popNIfOK(argCount);
    },
    scratch_primitiveGetFolderPath: function(argCount) {
        var index = this.stackInteger(0);
        if (!this.success) return false;
        var path;
        switch (index) {
            case 1: path = '/'; break;              // home dir
            // case 2: path = '/desktop'; break;    // desktop
            // case 3: path = '/documents'; break;  // documents
            // case 4: path = '/pictures'; break;   // my pictures
            // case 5: path = '/music'; break;      // my music
        }
        if (!path) return false;
        this.vm.popNandPush(argCount + 1, this.makeStString(this.filenameToSqueak(path)));
        return true;
    },
},
'Obsolete', {
    primitiveFloatArrayAt: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAt", argCount);
    },
    primitiveFloatArrayMulFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveMulFloatArray", argCount);
    },
    primitiveFloatArrayAddScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAddScalar", argCount);
    },
    primitiveFloatArrayDivFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDivFloatArray", argCount);
    },
    primitiveFloatArrayDivScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDivScalar", argCount);
    },
    primitiveFloatArrayHash: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveHash", argCount);
    },
    primitiveFloatArrayAtPut: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAtPut", argCount);
    },
    primitiveFloatArrayMulScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveMulScalar", argCount);
    },
    primitiveFloatArrayAddFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAddFloatArray", argCount);
    },
    primitiveFloatArraySubScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveSubScalar", argCount);
    },
    primitiveFloatArraySubFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveSubFloatArray", argCount);
    },
    primitiveFloatArrayEqual: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveEqual", argCount);
    },
    primitiveFloatArrayDotProduct: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDotProduct", argCount);
    },
    m23PrimitiveInvertRectInto: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveInvertRectInto", argCount);
    },
    m23PrimitiveTransformPoint: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveTransformPoint", argCount);
    },
    m23PrimitiveIsPureTranslation: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveIsPureTranslation", argCount);
    },
    m23PrimitiveComposeMatrix: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveComposeMatrix", argCount);
    },
    m23PrimitiveTransformRectInto: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveTransformRectInto", argCount);
    },
    m23PrimitiveIsIdentity: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveIsIdentity", argCount);
    },
    m23PrimitiveInvertPoint: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveInvertPoint", argCount);
    },
    primitiveDeflateBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveDeflateBlock", argCount);
    },
    primitiveDeflateUpdateHashTable: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveDeflateUpdateHashTable", argCount);
    },
    primitiveUpdateGZipCrc32: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveUpdateGZipCrc32", argCount);
    },
    primitiveInflateDecompressBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveInflateDecompressBlock", argCount);
    },
    primitiveZipSendBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveZipSendBlock", argCount);
    },
    primitiveFFTTransformData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTTransformData", argCount);
    },
    primitiveFFTScaleData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTScaleData", argCount);
    },
    primitiveFFTPermuteData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTPermuteData", argCount);
    },
});

Object.subclass('Squeak.InterpreterProxy',
// provides function names exactly like the C interpreter, for ease of porting
// but maybe less efficiently because of the indirection
'initialization', {
    VM_PROXY_MAJOR: 1,
    VM_PROXY_MINOR: 11,
    initialize: function(vm) {
        this.vm = vm;
        this.remappableOops = [];
        Object.defineProperty(this, 'successFlag', {
          get: function() { return vm.primHandler.success; },
          set: function(success) { vm.primHandler.success = success; },
        });
    },
    majorVersion: function() {
        return this.VM_PROXY_MAJOR;
    },
    minorVersion: function() {
        return this.VM_PROXY_MINOR;
    },
},
'success',
{
    failed: function() {
        return !this.successFlag;
    },
    primitiveFail: function() {
        this.successFlag = false;
    },
    success: function(boolean) {
        if (!boolean) this.successFlag = false;
    },
},
'stack access',
{
    pop: function(n) {
        this.vm.popN(n);
    },
    popthenPush: function(n, obj) {
        this.vm.popNandPush(n, obj);
    },
    push: function(obj) {
        this.vm.push(obj);
    },
    pushBool: function(bool) {
        this.vm.push(bool ? this.vm.trueObj : this.vm.falseObj);
    },
    pushInteger: function(int) {
        this.vm.push(int);
    },
    pushFloat: function(num) {
        this.vm.push(this.floatObjectOf(num));
    },
    stackValue: function(n) {
        return this.vm.stackValue(n);
    },
	stackIntegerValue: function(n) {
        var int = this.vm.stackValue(n);
        if (typeof int === "number") return int;
        this.successFlag = false;
        return 0;
    },
    stackFloatValue: function(n) {
        this.vm.success = true;
        var float = this.vm.stackIntOrFloat(n);
        if (this.vm.success) return float;
        this.successFlag = false;
        return 0;
    },
    stackObjectValue: function(n) {
        var obj = this.vm.stackValue(n);
        if (typeof obj !== "number") return obj;
        this.successFlag = false;
        return this.vm.nilObj;
    },
    stackBytes: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.bytes) return oop.bytes;
        if (oop.words) return oop.wordsAsUint8Array();
        if (typeof oop === "number" || !oop.isWordsOrBytes()) this.successFlag = false;
        return [];
    },
    stackWords: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.words;
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackInt32Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsInt32Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackInt16Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsInt16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackUint16Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsUint16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
},
'object access',
{
    isBytes: function(obj) {
        return typeof obj !== "number" && obj.isBytes();
    },
    isWords: function(obj) {
        return typeof obj !== "number" && obj.isWords();
    },
    isWordsOrBytes: function(obj) {
        return typeof obj !== "number" && obj.isWordsOrBytes();
    },
    isPointers: function(obj) {
        return typeof obj !== "number" && obj.isPointers();
    },
    isIntegerValue: function(obj) {
        return typeof obj === "number" && obj >= -0x40000000 && obj <= 0x3FFFFFFF;
    },
    isMemberOf: function(obj, className) {
        var nameBytes = obj.sqClass.pointers[Squeak.Class_name].bytes;
        if (className.length !== nameBytes.length) return false;
        for (var i = 0; i < className.length; i++)
            if (className.charCodeAt(i) !== nameBytes[i]) return false;
        return true;
    },
    booleanValueOf: function(obj) {
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        this.successFlag = false;
        return false;
    },
    positive32BitValueOf: function(obj) {
        return this.vm.primHandler.positive32BitValueOf(obj);
    },
    positive32BitIntegerFor: function(int) {
        return this.vm.primHandler.pos32BitIntFor(int);
    },
    floatValueOf: function(obj) {
        if (obj.isFloat) return obj.float;
        this.successFlag = false;
        return 0;
    },
    floatObjectOf: function(num) {
        return this.vm.primHandler.makeFloat(num);
    },
    fetchPointerofObject: function(n, obj) {
        return obj.pointers[n];
    },
    fetchBytesofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.bytes) return oop.bytes;
        if (oop.words) return oop.wordsAsUint8Array();
        if (typeof oop === "number" || !oop.isWordsOrBytes()) this.successFlag = false;
        return [];
    },
    fetchWordsofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.words;
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchInt32ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsInt32Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchInt16ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsInt16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchUint16ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsUint16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchIntegerofObject: function(n, obj) {
	    var int = obj.pointers[n];
	    if (typeof int === "number") return int;
	    this.successFlag = false;
	    return 0;
    },
    fetchLong32ofObject: function(n, obj) {
        return obj.words[n];
    },
    fetchFloatofObject: function(n, obj) {
        return this.floatValueOf(obj.pointers[n]);
    },
    storeIntegerofObjectwithValue: function(n, obj, value) {
        if (typeof value === "number")
            obj.pointers[n] = value;
        else this.successFlag = false;
    },
    storePointerofObjectwithValue: function(n, obj, value) {
        obj.pointers[n] = value;
    },
    stObjectatput: function(array, index, obj) {
        if (array.sqClass !== this.classArray()) throw Error("Array expected");
        if (index < 1 || index >= array.pointers.length) return this.successFlag = false;
        array.pointers[index] = obj;
    },
}, 
'constant access',
{
    isKindOfInteger: function(obj) {
        return typeof obj === "number" ||
            obj.sqClass == this.classLargeNegativeInteger() ||
            obj.sqClass == this.classLargePositiveInteger();
    },
    classArray: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassArray];
    },
    classSmallInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassInteger];
    },
    classLargePositiveInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger];
    },
    classLargeNegativeInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassLargeNegativeInteger];
    },
    classPoint: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassPoint];
    },
    classString: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassString];
    },
    nilObject: function() {
        return this.vm.nilObj;
    },
    falseObject: function() {
        return this.vm.falseObj;
    },
    trueObject: function() {
        return this.vm.trueObj;
    },
},
'vm functions',
{
    instantiateClassindexableSize: function(aClass, indexableSize) {
        return this.vm.instantiateClass(aClass, indexableSize);
    },
    methodArgumentCount: function() {
        return this.argCount;
    },
    makePointwithxValueyValue: function(x, y) {
        return this.vm.primHandler.makePointWithXandY(x, y);
    },
    pushRemappableOop: function(obj) {
        this.remappableOops.push(obj);
    },
    popRemappableOop: function() {
        return this.remappableOops.pop();
    },
    showDisplayBitsLeftTopRightBottom: function(form, left, top, right, bottom) {
        if (left < right && top < bottom) {
            var rect = {left: left, top: top, right: right, bottom: bottom};
            this.vm.primHandler.displayDirty(form, rect);
        }
    },
    ioLoadFunctionFrom: function(funcName, pluginName) {
        return null;
    },
});

Object.extend(Squeak, {
    fsck: function(dir, files) {
        dir = dir || "";
        if (!files) {
            // find existing files
            files = {};
            for (var key in localStorage) {
                var match = key.match(/squeak-file(\.lz)?:(.*)$/);
                if (match) {files[match[2]] = true};
            }
            if (typeof indexedDB !== "undefined") {
                return this.dbTransaction("readonly", "fsck cursor", function(fileStore) {
                    var cursorReq = fileStore.openCursor();
                    cursorReq.onsuccess = function(e) {
                        var cursor = e.target.result;
                        if (cursor) {
                            files[cursor.key] = true;
                            cursor.continue();
                        } else { // done
                            Squeak.fsck(dir, files);
                        }
                    }
                    cursorReq.onerror = function(e) {
                        console.error("fsck failed");
                    }
                });
            }
        }
        // check directories
        var entries = Squeak.dirList(dir);
        for (var name in entries) {
            var path = dir + "/" + name,
                isDir = entries[name][3];
            if (isDir) {
                var exists = "squeak:" + path in localStorage;
                if (exists) Squeak.fsck(path, files);
                else {
                    console.log("Deleting stale directory " + path);
                    Squeak.dirDelete(path);
                }
            } else {
                if (!files[path]) {
                    console.log("Deleting stale file entry " + path);
                    Squeak.fileDelete(path, true);
                } else {
                    files[path] = false; // mark as visited
                }
            }
        }
        // check orphaned files
        if (dir === "") {
            var orphaned = [],
                total = 0;
            for (var path in files) {
                total++;
                if (files[path]) orphaned.push(path); // not marked visited
            }
            if (orphaned.length > 0) {
                for (var i = 0; i < orphaned.length; i++) {
                    console.log("Deleting orphaned file " + orphaned[i]);
                    delete localStorage["squeak-file:" + orphaned[i]];
                    delete localStorage["squeak-file.lz:" + orphaned[i]];
                }
                if (typeof indexedDB !== "undefined") {
                    this.dbTransaction("readwrite", "fsck delete", function(fileStore) {
                        for (var i = 0; i < orphaned.length; i++) {
                            fileStore.delete(orphaned[i]);
                        };
                    });
                }
            }
        }
    },
    dbTransaction: function(mode, description, transactionFunc, completionFunc) {
        // File contents is stored in the IndexedDB named "squeak" in object store "files"
        // and directory entries in localStorage with prefix "squeak:"
        if (typeof indexedDB == "undefined") {
            transactionFunc(this.dbFake());
            if (completionFunc) completionFunc();
            return;
        }

        var startTransaction = function() {
            var trans = SqueakDB.transaction("files", mode),
                fileStore = trans.objectStore("files");
            trans.oncomplete = function(e) { if (completionFunc) completionFunc(); }
            trans.onerror = function(e) { console.error("transaction error:" + e.target.error.name + " (" + description + ")"); }
            trans.onabort = function(e) { console.error("transaction aborted: " + e.target.error.name + " (" + description + ")"); }
            transactionFunc(fileStore);
        };

        // if database connection already opened, just do transaction
        if (window.SqueakDB) return startTransaction();
        
        // otherwise, open SqueakDB first
        var openReq = indexedDB.open("squeak");
        openReq.onsuccess = function(e) {
            window.SqueakDB = this.result;
            SqueakDB.onversionchange = function(e) {
                delete window.SqueakDB;
                this.close();
            };
            SqueakDB.onerror = function(e) {
                console.log("Error accessing database: " + e.target.errorCode);
            };
            startTransaction();
        };
        openReq.onupgradeneeded = function (e) {
            // run only first time, or when version changed
            console.log("Creating database version " + e.newVersion);
            var db = e.target.result;
            db.createObjectStore("files");
        };
        openReq.onerror = function(e) {
            console.log("Error opening database: " + e.target.errorCode);
        };
        openReq.onblocked = function(e) {
            // If some other tab is loaded with the database, then it needs to be closed
            // before we can proceed upgrading the database.
            alert("Database upgrade needed. Please close all other tabs with this site open!");
        };
    },
    dbFake: function() {
        // indexedDB is not supported by this browser, fake it using localStorage
        // since localStorage space is severly limited, use LZString if loaded
        // see https://github.com/pieroxy/lz-string
        if (typeof SqueakDBFake == "undefined") {
            if (typeof indexedDB == "undefined")
                console.warn("IndexedDB not supported by this browser, using localStorage");
            window.SqueakDBFake = {
                bigFiles: {},
                bigFileThreshold: 100000,
                get: function(filename) {
                    var buffer = SqueakDBFake.bigFiles[filename];
                    if (!buffer) {
                        var string = localStorage["squeak-file:" + filename];
                        if (!string) {
                            var compressed = localStorage["squeak-file.lz:" + filename];
                            if (compressed) {
                                if (typeof LZString == "object") {
                                    string = LZString.decompressFromUTF16(compressed);
                                } else {
                                    console.error("LZString not loaded: cannot decompress " + filename);
                                }
                            }
                        }
                        if (string) {
                            var bytes = new Uint8Array(string.length);
                            for (var i = 0; i < bytes.length; i++)
                                bytes[i] = string.charCodeAt(i) & 0xFF;
                            buffer = bytes.buffer;
                        }
                    }
                    var req = {result: buffer};
                    setTimeout(function(){
                        if (buffer && req.onsuccess) req.onsuccess();
                        if (!buffer && req.onerror) req.onerror();
                    }, 0);
                    return req;
                },
                put: function(buffer, filename) {
                    if (buffer.byteLength > SqueakDBFake.bigFileThreshold) {
                        if (!SqueakDBFake.bigFiles[filename])
                            console.log("File " + filename + " (" + buffer.byteLength + " bytes) too large, storing in memory only");
                        SqueakDBFake.bigFiles[filename] = buffer;
                    } else {
                        var string = Squeak.bytesAsString(new Uint8Array(buffer));
                        if (typeof LZString == "object") {
                            var compressed = LZString.compressToUTF16(string);
                            localStorage["squeak-file.lz:" + filename] = compressed;
                            delete localStorage["squeak-file:" + filename];
                        } else {
                            localStorage["squeak-file:" + filename] = string;
                        }
                    }
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
                delete: function(filename) {
                    delete localStorage["squeak-file:" + filename];
                    delete localStorage["squeak-file.lz:" + filename];
                    delete SqueakDBFake.bigFiles[filename];
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
            }
        }
        return SqueakDBFake;
    },
    fileGet: function(filepath, thenDo, errorDo) {
        if (!errorDo) errorDo = function(err) { console.log(err) };
        var path = this.splitFilePath(filepath);
        if (!path.basename) return errorDo("Invalid path: " + filepath);
        this.dbTransaction("readonly", "get " + filepath, function(fileStore) {
            var getReq = fileStore.get(path.fullname);
            getReq.onerror = function(e) { errorDo(this.errorCode) };
            getReq.onsuccess = function(e) {
                if (this.result !== undefined) return thenDo(this.result);
                // might be a template
                Squeak.fetchTemplateFile(path.fullname,
                    function gotTemplate(template) {thenDo(template)},
                    function noTemplate() {
                        // if no indexedDB then we have checked fake db already
                        if (typeof indexedDB == "undefined") return errorDo("file not found: " + path.fullname);
                        // fall back on fake db, may be file is there
                        var fakeReq = Squeak.dbFake().get(path.fullname);
                        fakeReq.onerror = function(e) { errorDo("file not found: " + path.fullname) };
                        fakeReq.onsuccess = function(e) { thenDo(this.result); }
                    });
            };
        });
    },
    filePut: function(filepath, contents, optSuccess) {
        // store file, return dir entry if successful
        var path = this.splitFilePath(filepath); if (!path.basename) return null;
        var directory = this.dirList(path.dirname); if (!directory) return null;
        // get or create entry
        var entry = directory[path.basename],
            now = this.totalSeconds();
        if (!entry) { // new file
            entry = [/*name*/ path.basename, /*ctime*/ now, /*mtime*/ 0, /*dir*/ false, /*size*/ 0];
            directory[path.basename] = entry;
        } else if (entry[3]) // is a directory
            return null;
        // update directory entry
        entry[2] = now; // modification time
        entry[4] = contents.byteLength || contents.length || 0;
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        // put file contents (async)
        this.dbTransaction("readwrite", "put " + filepath,
            function(fileStore) {
                fileStore.put(contents, path.fullname);
            },
            function transactionComplete() {
                if (optSuccess) optSuccess();
            });
        return entry;
    },
    fileDelete: function(filepath, entryOnly) {
        var path = this.splitFilePath(filepath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        var entry = directory[path.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        // delete entry from directory
        delete directory[path.basename];
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        if (entryOnly) return true;
        // delete file contents (async)
        this.dbTransaction("readwrite", "delete " + filepath, function(fileStore) {
            fileStore.delete(path.fullname);
        });
        return true;
    },
    fileRename: function(from, to) {
        var oldpath = this.splitFilePath(from); if (!oldpath.basename) return false;
        var newpath = this.splitFilePath(to); if (!newpath.basename) return false;
        var olddir = this.dirList(oldpath.dirname); if (!olddir) return false;
        var entry = olddir[oldpath.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        var samedir = oldpath.dirname == newpath.dirname;
        var newdir = samedir ? olddir : this.dirList(newpath.dirname); if (!newdir) return false;
        if (newdir[newpath.basename]) return false; // exists already
        delete olddir[oldpath.basename];            // delete old entry
        entry[0] = newpath.basename;                // rename entry
        newdir[newpath.basename] = entry;           // add new entry
        localStorage["squeak:" + newpath.dirname] = JSON.stringify(newdir);
        if (!samedir) localStorage["squeak:" + oldpath.dirname] = JSON.stringify(olddir);
        // move file contents (async)
        this.fileGet(oldpath.fullname,
            function success(contents) {
                this.dbTransaction("readwrite", "rename " + oldpath.fullname + " to " + newpath.fullname, function(fileStore) {
                    fileStore.delete(oldpath.fullname);
                    fileStore.put(contents, newpath.fullname);
                });
            }.bind(this),
            function error(msg) {
                console.log("File rename failed: " + msg);
            }.bind(this));
        return true;
    },
    fileExists: function(filepath) {
        var path = this.splitFilePath(filepath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        var entry = directory[path.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        return true;
    },
    dirCreate: function(dirpath, withParents) {
        var path = this.splitFilePath(dirpath); if (!path.basename) return false;
        if (withParents && !localStorage["squeak:" + path.dirname]) Squeak.dirCreate(path.dirname, true);
        var directory = this.dirList(path.dirname); if (!directory) return false;
        if (directory[path.basename]) return false;
        var now = this.totalSeconds(),
            entry = [/*name*/ path.basename, /*ctime*/ now, /*mtime*/ now, /*dir*/ true, /*size*/ 0];
        directory[path.basename] = entry;
        localStorage["squeak:" + path.fullname] = JSON.stringify({});
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        return true;
    },
    dirDelete: function(dirpath) {
        var path = this.splitFilePath(dirpath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        if (!directory[path.basename]) return false;
        var children = this.dirList(path.fullname);
        if (!children) return false;
        for (var child in children) return false; // not empty
        // delete from parent
        delete directory[path.basename];
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        // delete itself
        delete localStorage["squeak:" + path.fullname];
        return true;
    },
    dirList: function(dirpath, includeTemplates) {
        // return directory entries or null
        var path = this.splitFilePath(dirpath),
            localEntries = localStorage["squeak:" + path.fullname],
            template = includeTemplates && localStorage["squeak-template:" + path.fullname];
        if (localEntries || template) {
            var dir = {};
            function addEntries(entries) {
                for (var key in entries) {
                    if (entries.hasOwnProperty(key)) {
                        var entry = entries[key];
                        dir[entry[0]] = entry;
                    }
                }
            }
            // local entries override templates
            if (template) addEntries(JSON.parse(template).entries);
            if (localEntries) addEntries(JSON.parse(localEntries));
            return dir;
        }
        if (path.fullname == "/") return {};
        return null;
    },
    splitFilePath: function(filepath) {
        if (filepath[0] !== '/') filepath = '/' + filepath;
        filepath = filepath.replace(/\/\//ig, '/');      // replace double-slashes
        var matches = filepath.match(/(.*)\/(.*)/),
            dirname = matches[1].length ? matches[1] : '/',
            basename = matches[2].length ? matches[2] : null;
        return {fullname: filepath, dirname: dirname, basename: basename};
    },
    bytesAsString: function(bytes) {
	var chars = [];
        for (var i = 0; i < bytes.length; i++)
            chars.push(String.fromCharCode(bytes[i]));
	return chars.join('');
    },
    flushFile: function(file) {
        if (file.modified) {
            var buffer = file.contents.buffer;
            if (buffer.byteLength !== file.size) {
                buffer = new ArrayBuffer(file.size);
                (new Uint8Array(buffer)).set(file.contents.subarray(0, file.size));
            }
            Squeak.filePut(file.name, buffer);
            // if (/SqueakDebug.log/.test(file.name)) {
            //     var chars = Squeak.bytesAsString(new Uint8Array(buffer));
            //     console.warn(chars.replace(/\r/g, '\n'));
            // }
            file.modified = false;
        }
    },
    flushAllFiles: function() {
        if (typeof SqueakFiles == 'undefined') return;
        for (var name in SqueakFiles)
            this.flushFile(SqueakFiles[name]);
    },
    closeAllFiles: function() {
        // close the files held open in memory
        Squeak.flushAllFiles();
        delete window.SqueakFiles;
    },
    fetchTemplateDir: function(path, url) {
        // Called on app startup. Fetch url/sqindex.json and
        // cache all subdirectory entries in localStorage.
        // File contents is only fetched on demand
        path = Squeak.splitFilePath(path).fullname;
        function ensureTemplateParent(template) {
            var path = Squeak.splitFilePath(template);
            if (path.dirname !== "/") ensureTemplateParent(path.dirname);
            var template = JSON.parse(localStorage["squeak-template:" + path.dirname] || '{"entries": {}}');
            if (!template.entries[path.basename]) {
                var now = Squeak.totalSeconds();
                template.entries[path.basename] = [path.basename, now, now, true, 0];
                localStorage["squeak-template:" + path.dirname] = JSON.stringify(template);
            }
        }
        function checkSubTemplates(path, url) {
            var template = JSON.parse(localStorage["squeak-template:" + path]);
            template.entries.forEach(function(entry) {
                if (entry[3]) Squeak.fetchTemplateDir(path + "/" + entry[0], url + "/" + entry[0]);
            });
        }
        if (localStorage["squeak-template:" + path]) {
            checkSubTemplates(path, url);
        } else  {
            var index = url + "/sqindex.json";
            var rq = new XMLHttpRequest();
            rq.open('GET', index, true);
            rq.onload = function(e) {
                if (rq.status == 200) {
                    console.log("adding template " + path);
                    ensureTemplateParent(path);
                    localStorage["squeak-template:" + path] = '{"url": ' + JSON.stringify(url) + ', "entries": ' + rq.response + '}';
                    checkSubTemplates(path, url);
                }
                else rq.onerror(rq.statusText);
            };
            rq.onerror = function(e) {
                console.log("cannot load template index " + index);
            }
            rq.send();
        }
    },
    fetchTemplateFile: function(path, ifFound, ifNotFound) {
        path = Squeak.splitFilePath(path);
        var template = localStorage["squeak-template:" + path.dirname];
        if (!template) return ifNotFound();
        var url = JSON.parse(template).url;
        if (!url) return ifNotFound();
        url += "/" + path.basename;
        var rq = new XMLHttpRequest();
        rq.open("get", url, true);
        rq.responseType = "arraybuffer";
        rq.timeout = 30000;
        rq.onreadystatechange = function() {
            if (this.readyState != this.DONE) return;
            if (this.status == 200) {
                var buffer = this.response;
                console.log("Got " + buffer.byteLength + " bytes from " + url);
                Squeak.dirCreate(path.dirname, true);
                Squeak.filePut(path.fullname, buffer);
                ifFound(buffer);
            } else {
                alert("Download failed (" + this.status + ") " + url);
                ifNotFound();
            }
        }
        console.log("Fetching " + url);
        rq.send();
    },
    totalSeconds: function() {
        // seconds since 1901-01-01, local time
        return Math.floor((Date.now() - Squeak.Epoch) / 1000);
    },
    startAudioOut: function() {
        if (!this.audioOutContext) {
            var ctxProto = window.AudioContext || window.webkitAudioContext
                || window.mozAudioContext || window.msAudioContext;
            this.audioOutContext = ctxProto && new ctxProto();
        }
        return this.audioOutContext;
    },
    startAudioIn: function(thenDo, errorDo) {
        if (this.audioInContext) {
            this.audioInSource.disconnect();
            return thenDo(this.audioInContext, this.audioInSource);
        }
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
            || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        if (!navigator.getUserMedia) return errorDo("test: audio input not supported");
        navigator.getUserMedia({audio: true, toString: function() {return "audio"}},
            function onSuccess(stream) {
                var ctxProto = window.AudioContext || window.webkitAudioContext
                    || window.mozAudioContext || window.msAudioContext;
                this.audioInContext = ctxProto && new ctxProto();
                this.audioInSource = this.audioInContext.createMediaStreamSource(stream);
                thenDo(this.audioInContext, this.audioInSource);
            },
            function onError() {
                errorDo("cannot access microphone");
            });
    },
    stopAudio: function() {
        if (this.audioInSource)
            this.audioInSource.disconnect();
    },
});

Object.subclass('Squeak.InstructionPrinter',
'initialization', {
    initialize: function(method, vm) {
        this.method = method;
        this.vm = vm;
    },
},
'printing', {
    printInstructions: function(indent, highlight, highlightPC) {
        // all args are optional
        this.indent = indent;           // prepend to every line except if highlighted
        this.highlight = highlight;     // prepend to highlighted line
        this.highlightPC = highlightPC; // PC of highlighted line
        this.innerIndents = {};
        this.result = '';
        this.scanner = new Squeak.InstructionStream(this.method, this.vm);
        this.oldPC = this.scanner.pc;
        this.endPC = 0;                 // adjusted while scanning
        this.done = false;
        while (!this.done)
        	this.scanner.interpretNextInstructionFor(this);
        return this.result;
    },
    print: function(instruction) {
        if (this.oldPC === this.highlightPC) {
            if (this.highlight) this.result += this.highlight;
        } else {
            if (this.indent) this.result += this.indent;
        }
        this.result += this.oldPC;
        for (var i = 0; i < this.innerIndents[this.oldPC] || 0; i++)
            this.result += "   ";
        this.result += " <";
        for (var i = this.oldPC; i < this.scanner.pc; i++) {
            if (i > this.oldPC) this.result += " ";
            this.result += (this.method.bytes[i]+0x100).toString(16).substr(-2).toUpperCase(); // padded hex
        }
        this.result += "> " + instruction + "\n";
        this.oldPC = this.scanner.pc;
    }
},
'decoding', {
    blockReturnTop: function() {
    	this.print('blockReturn');
    },
    doDup: function() {
    	this.print('dup');
    },
    doPop: function() {
    	this.print('pop');
    },
	jump: function(offset) {
        this.print('jumpTo: ' + (this.scanner.pc + offset));
        if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
    },
    jumpIf: function(condition, offset) {
        this.print((condition ? 'jumpIfTrue: ' : 'jumpIfFalse: ') + (this.scanner.pc + offset));
        if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
    },
    methodReturnReceiver: function() {
        this.print('return: receiver');
        this.done = this.scanner.pc > this.endPC;
    },
    methodReturnTop: function() {
        this.print('return: topOfStack');
        this.done = this.scanner.pc > this.endPC;
    },
    methodReturnConstant: function(obj) {
        this.print('returnConst: ' + obj.toString());
        this.done = this.scanner.pc > this.endPC;
    },
    popIntoLiteralVariable: function(anAssociation) { 
    	this.print('popIntoBinding: ' + anAssociation.assnKeyAsString());
    },
    popIntoReceiverVariable: function(offset) { 
    	this.print('popIntoInstVar: ' + offset);
    },
    popIntoTemporaryVariable: function(offset) { 
    	this.print('popIntoTemp: ' + offset);
    },
	pushActiveContext: function() {
	    this.print('push: thisContext');
    },
    pushConstant: function(obj) {
        var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
        this.print('pushConst: ' + value);
    },
    pushLiteralVariable: function(anAssociation) {
    	this.print('pushBinding: ' + anAssociation.assnKeyAsString());
    },
	pushReceiver: function() {
	    this.print('push: self');
    },
    pushReceiverVariable: function(offset) { 
    	this.print('pushInstVar: ' + offset);
    },
	pushTemporaryVariable: function(offset) {
	    this.print('pushTemp: ' + offset);
    },
    send: function(selector, numberArguments, supered) {
    	this.print( (supered ? 'superSend: #' : 'send: #') + (selector.bytesAsString ? selector.bytesAsString() : selector));
    },
    storeIntoLiteralVariable: function(anAssociation) {
    	this.print('storeIntoBinding: ' + anAssociation.assnKeyAsString());
    },
    storeIntoReceiverVariable: function(offset) { 
    	this.print('storeIntoInstVar: ' + offset);
    },
	storeIntoTemporaryVariable: function(offset) {
	    this.print('storeIntoTemp: ' + offset);
    },
    pushNewArray: function(size) {
        this.print('push: (Array new: ' + size + ')');
    },
    popIntoNewArray: function(numElements) {
        this.print('pop: ' + numElements + ' into: (Array new: ' + numElements + ')');
    },
    pushRemoteTemp: function(offset , arrayOffset) {
        this.print('push: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    storeIntoRemoteTemp: function(offset , arrayOffset) {
        this.print('storeInto: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    popIntoRemoteTemp: function(offset , arrayOffset) {
        this.print('popInto: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    pushClosureCopy: function(numCopied, numArgs, blockSize) {
        var from = this.scanner.pc,
            to = from + blockSize;
        this.print('closure(' + from + '-' + (to-1) + '): ' + numCopied + ' captured, ' + numArgs + ' args');
        for (var i = from; i < to; i++)
    		this.innerIndents[i] = (this.innerIndents[i] || 0) + 1;
    	if (to > this.endPC) this.endPC = to;
	},
});

Object.subclass('Squeak.InstructionStream',
'initialization', {
    initialize: function(method, vm) {
        this.vm = vm;
        this.method = method;
        this.pc = 0;
        this.specialConstants = ['true', 'false', 'nil', '-1', '0', '1', '2'];
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
        this.specialSelectorsNArgs = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 1,
            0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0];
    },
},
'decoding',
{
    interpretNextInstructionFor: function(client) {
    	// Send to the argument, client, a message that specifies the type of the next instruction.
    	var method = this.method;
    	var byte = method.bytes[this.pc++];
    	var type = (byte / 16) | 0;  
    	var offset = byte % 16;
    	if (type === 0) return client.pushReceiverVariable(offset);
    	if (type === 1) return client.pushTemporaryVariable(offset);
    	if (type === 2) return client.pushConstant(method.methodGetLiteral(offset));
    	if (type === 3) return client.pushConstant(method.methodGetLiteral(offset + 16));
    	if (type === 4) return client.pushLiteralVariable(method.methodGetLiteral(offset));
    	if (type === 5) return client.pushLiteralVariable(method.methodGetLiteral(offset + 16));
    	if (type === 6)
    		if (offset<8) return client.popIntoReceiverVariable(offset)
    		else return client.popIntoTemporaryVariable(offset-8);
    	if (type === 7) {
            if (offset===0) return client.pushReceiver()
			if (offset < 8) return client.pushConstant(this.specialConstants[offset - 1])
			if (offset===8) return client.methodReturnReceiver();
			if (offset < 12) return client.methodReturnConstant(this.specialConstants[offset - 9]);
			if (offset===12) return client.methodReturnTop();
			if (offset===13) return client.blockReturnTop();
			if (offset > 13) throw Error("unusedBytecode");
    	}
    	if (type === 8) return this.interpretExtension(offset, method, client);
    	if (type === 9) // short jumps
    			if (offset<8) return client.jump(offset+1);
    			else return client.jumpIf(false, offset-8+1);
    	if (type === 10) {// long jumps
    		byte = this.method.bytes[this.pc++];
			if (offset<8) return client.jump((offset-4)*256 + byte);
			else return client.jumpIf(offset<12, (offset & 3)*256 + byte);
    	}
    	if (type === 11)
            return client.send(this.specialSelectors[offset], 
				this.specialSelectorsNArgs[offset],
				false);
    	if (type === 12)
            return client.send(this.specialSelectors[offset+16], 
				this.specialSelectorsNArgs[offset+16],
				false);
    	if (type > 12)
    		return client.send(method.methodGetLiteral(offset), type-13, false);
    },
    interpretExtension: function(offset, method, client) {
    	if (offset <= 6) { // Extended op codes 128-134
    		var byte2 = this.method.bytes[this.pc++];
    		if (offset <= 2) { // 128-130:  extended pushes and pops
    			var type = byte2 / 64 | 0;
    			var offset2 = byte2 % 64;
    			if (offset === 0) {
    			    if (type === 0) return client.pushReceiverVariable(offset2);
    				if (type === 1) return client.pushTemporaryVariable(offset2);
    				if (type === 2) return client.pushConstant(this.method.methodGetLiteral(offset2));
    				if (type === 3) return client.pushLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    			if (offset === 1) {
    			    if (type === 0) return client.storeIntoReceiverVariable(offset2);
    				if (type === 1) return client.storeIntoTemporaryVariable(offset2);
    				if (type === 2) throw Error("illegalStore");
    				if (type === 3) return client.storeIntoLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    			if (offset === 2) {
        			if (type === 0) return client.popIntoReceiverVariable(offset2);
    				if (type === 1) return client.popIntoTemporaryVariable(offset2);
    				if (type === 2) throw Error("illegalStore");
    				if (type === 3) return client.popIntoLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    		}
    		// 131-134 (extended sends)
    		if (offset === 3) // Single extended send
    			return client.send(this.method.methodGetLiteral(byte2 % 32), byte2 / 32 | 0, false);
    		if (offset === 4) { // Double extended do-anything
    			var byte3 = this.method.bytes[this.pc++];
    			var type = byte2 / 32 | 0;
    			if (type === 0) return client.send(this.method.methodGetLiteral(byte3), byte2 % 32, false);
    			if (type === 1) return client.send(this.method.methodGetLiteral(byte3), byte2 % 32, true);
    			if (type === 2) return client.pushReceiverVariable(byte3);
    			if (type === 3) return client.pushConstant(this.method.methodGetLiteral(byte3));
    			if (type === 4) return client.pushLiteralVariable(this.method.methodGetLiteral(byte3));
    			if (type === 5) return client.storeIntoReceiverVariable(byte3);
    			if (type === 6) return client.popIntoReceiverVariable(byte3);
    			if (type === 7) return client.storeIntoLiteralVariable(this.method.methodGetLiteral(byte3));
    		}
    		if (offset === 5) // Single extended send to super
    			return client.send(this.method.methodGetLiteral(byte2 & 31), byte2 >> 5, true);
    		if (offset === 6) // Second extended send
    			return client.send(this.method.methodGetLiteral(byte2 & 63), byte2 >> 6, false);
    	}
    	if (offset === 7) return client.doPop();
    	if (offset === 8) return client.doDup();
    	if (offset === 9) return client.pushActiveContext();
        // closures
        var byte2 = this.method.bytes[this.pc++];
        if (offset === 10)
            return byte2 < 128 ? client.pushNewArray(byte2) : client.popIntoNewArray(byte2 - 128);
        if (offset === 11) throw Error("unusedBytecode");
        var byte3 = this.method.bytes[this.pc++];
        if (offset === 12) return client.pushRemoteTemp(byte2, byte3);
        if (offset === 13) return client.storeIntoRemoteTemp(byte2, byte3);
        if (offset === 14) return client.popIntoRemoteTemp(byte2, byte3);
        // offset === 15
        var byte4 = this.method.bytes[this.pc++];
        return client.pushClosureCopy(byte2 >> 4, byte2 & 0xF, (byte3 * 256) + byte4);
    }
});

}) // end of module

/***** including ../jit.js *****/

module('users.bert.SqueakJS.jit').requires("users.bert.SqueakJS.vm").toRun(function() {
/*
 * Copyright (c) 2014 Bert Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

Object.subclass('Squeak.Compiler',

/****************************************************************************

VM and Compiler
===============

The VM has an interpreter, it will work fine (and much more memory-efficient)
without loading a compiler. The compiler plugs into the VM by providing the
Squeak.Compiler global. It can be easily replaced by just loading a different
script providing Squeak.Compiler.

The VM creates the compiler instance after an image has been loaded and the VM
been initialized. Whenever a method is activated that was not compiled yet, the
compiler gets a chance to compile it. The compiler may decide to wait for a couple
of activations before actually compiling it. This might prevent do-its from ever
getting compiled, because they are only activated once. Therefore, the compiler
is also called when a long-running non-optimized loop calls checkForInterrupts.
Finally, whenever the interpreter is about to execute a bytecode, it calls the
compiled method instead (which typically will execute many bytecodes):

    initialize:
        compiler = new Squeak.Compiler(vm);

    executeNewMethod, checkForInterrupts:
        if (!method.compiled && compiler)
            compiler.compile(method);

    interpret:
        if (method.compiled) method.compiled(vm);

Note that a compiler could hook itself into a compiled method by dispatching
to vm.compiler in the generated code. This would allow gathering statistics,
recompiling with optimized code etc.


About This Compiler
===================

The compiler in this file is meant to be simple, fast-compiling, and general.
It transcribes bytecodes 1-to-1 into equivalent JavaScript code using
templates (and thus can even support single-stepping). It uses the
interpreter's stack pointer (SP) and program counter (PC), actual context
objects just like the interpreter, no register mapping, it does not optimize
sends, etc.

Jumps are handled by wrapping the whole method in a loop and switch. This also
enables continuing in the middle of a compiled method: whenever another context
is activated, the method returns to the main loop, and is entered again later
with a different PC. Here is an example method, its bytecodes, and a simplified
version of the generated JavaScript code:

    method
        [value selector] whileFalse.
        ^ 42

    0 <00> pushInstVar: 0
    1 <D0> send: #selector
    2 <A8 02> jumpIfTrue: 6
    4 <A3 FA> jumpTo: 0
    6 <21> pushConst: 42
    7 <7C> return: topOfStack

    while (true) switch (vm.pc) {
    case 0:
        stack[++vm.sp] = inst[0];
        vm.pc = 2; vm.send(#selector);
        return 0;
    case 2:
        if (stack[vm.sp--] === vm.trueObj) {
            vm.pc = 6;
            continue; // jump to case 6
        }
        // otherwise fall through to next case
    case 4:
        vm.pc = 0;
        continue; // jump to case 0
    case 6:
        stack[++vm.sp] = 42;
        vm.pc = 7; vm.doReturn(stack[vm.sp]);
        return 0;
    }

The compiled method should return the number of bytecodes executed, but for
statistical purposes only. It's fine to return 0.

Debugging support
=================

This compiler supports generating single-stepping code and comments, which are
rather helpful during debugging.

Normally, only bytecodes that can be a jump target are given a label. Also,
bytecodes following a send operation need a label, to enable returning to that
spot after the context switch. All other bytecodes are executed continuously.

When compiling for single-stepping, each bytecode gets a label, and after each
bytecode a flag is checked and the method returns if needed. Because this is
a performance penalty, methods are first compiled without single-step support, 
and recompiled for single-stepping on demand.

This is optional, another compiler can answer false from enableSingleStepping().
In that case the VM will delete the compiled method and invoke the interpreter
to single-step.

*****************************************************************************/

'initialization', {
    initialize: function(vm) {
        this.vm = vm;
        this.comments = !!Squeak.Compiler.comments, // generate comments
        // for debug-printing only
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
    },
},
'accessing', {
    compile: function(method, optClass, optSel) {
        if (!method.isHot) {
            // 1st time
            method.isHot = true;
        } else {
            // 2nd time
            this.singleStep = false;
            this.debug = this.comments;
            var clsName = optClass && optClass.className(),
                sel = optSel && optSel.bytesAsString();
            method.compiled = this.generate(method, clsName, sel);
        }
    },
    enableSingleStepping: function(method, optClass, optSel) {
        // recompile method for single-stepping
        if (!method.compiled || !method.compiled.canSingleStep) {
            this.singleStep = true; // generate breakpoint support
            this.debug = true;
            var clsAndSel = this.vm.printMethod(method, optClass, optSel).split(">>");    // likely expensive
            method.compiled = this.generate(method, clsAndSel[0], clsAndSel[1]);
            method.compiled.canSingleStep = true;
        }
        // if a compiler does not support single-stepping, return false
        return true;
    },
    functionNameFor: function(cls, sel) {
        if (!cls || !sel) return "Squeak_DOIT";
        if (!/[^a-zA-Z:_]/.test(sel))
            return (cls + "_" + sel).replace(/[: ]/g, "_");
        var op = sel.replace(/./g, function(char) {
            var repl = {'|': "OR", '~': "NOT", '<': "LT", '=': "EQ", '>': "GT",
                    '&': "AND", '@': "AT", '*': "TIMES", '+': "PLUS", '\\': "MOD",
                    '-': "MINUS", ',': "COMMA", '/': "DIV", '?': "IF"}[char];
            return repl || 'OPERATOR';
        });
        return cls.replace(/[ ]/, "_") + "__" + op + "__";
    },
},
'generating',
{
    generate: function(method, optClass, optSel) {
        this.method = method;
        this.pc = 0;                // next bytecode
        this.endPC = 0;             // pc of furthest jump target
        this.prevPC = 0;            // pc at start of current instruction
        this.source = [];           // snippets will be joined in the end
        this.sourceLabels = {};     // source pos of generated labels 
        this.needsLabel = {0: true}; // jump targets
        this.needsBreak = false;    // insert break check for previous bytecode
        if (optClass && optSel)
            this.source.push("// ", optClass, ">>", optSel, "\n");
        this.source.push(
            "var context = vm.activeContext,\n",
            "    stack = context.pointers,\n",
            "    rcvr = vm.receiver,\n",
            "    inst = rcvr.pointers,\n",
            "    temp = vm.homeContext.pointers,\n",
            "    lit = vm.method.pointers,\n",
            "    bytecodes = 0 - vm.pc;\n",
            "while (true) switch (vm.pc) {\n"
        );
        this.done = false;
        while (!this.done) {
            var byte = method.bytes[this.pc++],
                byte2 = 0;
            switch (byte & 0xF8) {
                // load receiver variable
                case 0x00: case 0x08:
                    this.generatePush("inst[", byte & 0x0F, "]");
                    break;
                // load temporary variable
                case 0x10: case 0x18:
                    this.generatePush("temp[", 6 + (byte & 0xF), "]");
                    break;
                // loadLiteral
                case 0x20: case 0x28: case 0x30: case 0x38:
                    this.generatePush("lit[", 1 + (byte & 0x1F), "]");
                    break;
                // loadLiteralIndirect
                case 0x40: case 0x48: case 0x50: case 0x58:
                    this.generatePush("lit[", 1 + (byte & 0x1F), "].pointers[1]");
                    break;
                // storeAndPop rcvr
                case 0x60:
                    this.generatePopInto("inst[", byte & 0x07, "]"); 
                    break;
                // storeAndPop temp
                case 0x68:
                    this.generatePopInto("temp[", 6 + (byte & 0x07), "]");
                    break;
                // Quick push
                case 0x70:
                    switch (byte) {
                        case 0x70: this.generatePush("rcvr"); break;
                        case 0x71: this.generatePush("vm.trueObj"); break;
                        case 0x72: this.generatePush("vm.falseObj"); break;
                        case 0x73: this.generatePush("vm.nilObj"); break;
                        case 0x74: this.generatePush("-1"); break;
                        case 0x75: this.generatePush("0"); break;
                        case 0x76: this.generatePush("1"); break;
                        case 0x77: this.generatePush("2"); break;
                    }
                    break;
                // Quick return
                case 0x78:
                    switch (byte) {
                        case 0x78: this.generateReturn("rcvr"); break;
                        case 0x79: this.generateReturn("vm.trueObj"); break;
                        case 0x7A: this.generateReturn("vm.falseObj"); break;
                        case 0x7B: this.generateReturn("vm.nilObj"); break;
                        case 0x7C: this.generateReturn("stack[vm.sp]"); break;
                        case 0x7D: this.generateBlockReturn(); break;
                        default: throw Error("unusedBytecode");
                    }
                    break;
                // Extended bytecodes 
                case 0x80: case 0x88:
                    this.generateExtended(byte);
                    break;
                // short jump
                case 0x90:
                    this.generateJump((byte & 0x07) + 1);
                    break;
                // short conditional jump
                case 0x98:
                    this.generateJumpIf(false, (byte & 0x07) + 1);
                    break;
                // long jump, forward and back
                case 0xA0:
                    byte2 = method.bytes[this.pc++];
                    this.generateJump(((byte&7)-4) * 256 + byte2);
                    break;
                // long conditional jump
                case 0xA8:
                    byte2 = method.bytes[this.pc++];
                    this.generateJumpIf(byte < 0xAC, (byte & 3) * 256 + byte2);
                    break;
                // SmallInteger ops: + - < > <= >= = ~= * /  @ lshift: lxor: land: lor:
                case 0xB0: case 0xB8:
                    this.generateNumericOp(byte);
                    break;
                // quick primitives: // at:, at:put:, size, next, nextPut:, ...
                case 0xC0: case 0xC8:
                    this.generateQuickPrim(byte);
                    break;
                // send literal selector
                case 0xD0: case 0xD8:
                    this.generateSend("lit[", 1 + (byte & 0x0F), "]", 0, false);
                    break;
                case 0xE0: case 0xE8:
                    this.generateSend("lit[", 1 + (byte & 0x0F), "]", 1, false);
                    break;
                case 0xF0: case 0xF8:
                    this.generateSend("lit[", 1 + (byte & 0x0F), "]", 2, false);
                    break;
            }
        }
        var funcName = this.functionNameFor(optClass, optSel);
        if (this.singleStep) {
            if (this.debug) this.source.push("// all valid PCs have a label;\n");
            this.source.push("default: throw Error('invalid PC'); }"); // all PCs handled
            return new Function("return function " + funcName + "(vm, singleStep) {\n" + this.source.join("") + "\n}")();
        } else {
            if (this.debug) this.source.push("// fall back to single-stepping\n");
            this.source.push("default: bytecodes += vm.pc; vm.interpretOne(true); return bytecodes;}");
            this.deleteUnneededLabels();
            return new Function("return function " + funcName + "(vm) {\n" + this.source.join("") + "\n}")();
        }
    },
    generateExtended: function(bytecode) {
        switch (bytecode) {
            // extended push
            case 0x80:
                var byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePush("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePush("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: this.generatePush("lit[", 1 + (byte2 & 0x3F), "]"); return;
                    case 3: this.generatePush("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
            // extended store
            case 0x81:
                var byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generateStoreInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generateStoreInto("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: throw Error("illegal store into literal");
                    case 3: this.generateStoreInto("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
                }
                return;
            // extended pop into
            case 0x82:
                var byte2 = this.method.bytes[this.pc++];
                switch (byte2 >> 6) {
                    case 0: this.generatePopInto("inst[", byte2 & 0x3F, "]"); return;
                    case 1: this.generatePopInto("temp[", 6 + (byte2 & 0x3F), "]"); return;
                    case 2: throw Error("illegal pop into literal");
                    case 3: this.generatePopInto("lit[", 1 + (byte2 & 0x3F), "].pointers[1]"); return;
    			}
    		// Single extended send
    		case 0x83:
    		    var byte2 = this.method.bytes[this.pc++];
    		    this.generateSend("lit[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, false);
    		    return;
    		// Double extended do-anything
    		case 0x84:
    		    var byte2 = this.method.bytes[this.pc++];
    			var byte3 = this.method.bytes[this.pc++];
    			switch (byte2 >> 5) {
        			case 0: this.generateSend("lit[", 1 + byte3, "]", byte2 & 31, false); return;
        			case 1: this.generateSend("lit[", 1 + byte3, "]", byte2 & 31, true); return;
        			case 2: this.generatePush("inst[", byte3, "]"); return;
        			case 3: this.generatePush("lit[", 1 + byte3, "]"); return;
        			case 4: this.generatePush("lit[", 1 + byte3, "].pointers[1]"); return;
        			case 5: this.generateStoreInto("inst[", byte3, "]"); return;
        			case 6: this.generatePopInto("inst[", byte3, "]"); return;
        			case 7: this.generateStoreInto("lit[", 1 + byte3, "].pointers[1]"); return;
    			}
    		// Single extended send to super
    	    case 0x85:
    	        var byte2 = this.method.bytes[this.pc++];
    	        this.generateSend("lit[", 1 + (byte2 & 0x1F), "]", byte2 >> 5, true);
    	        return;
    	    // Second extended send
    		case 0x86:
    		     var byte2 = this.method.bytes[this.pc++];
        		 this.generateSend("lit[", 1 + (byte2 & 0x3F), "]", byte2 >> 6, false);
        		 return;
        	// pop
        	case 0x87:
        	    this.generateInstruction("pop", "vm.sp--");
        	    return;
        	// dup
        	case 0x88:
        	    this.generateInstruction("dup", "var dup = stack[vm.sp]; stack[++vm.sp] = dup");
        	    return;
        	// thisContext
        	case 0x89:
        	    this.generateInstruction("thisContext", "stack[++vm.sp] = context; vm.reclaimableContextCount = 0");
        	    return;
            // closures
            case 0x8A:
                var byte2 = this.method.bytes[this.pc++],
                    popValues = byte2 > 127,
                    count = byte2 & 127;
                this.generateClosureTemps(count, popValues);
                return;
            case 0x8B:
                throw Error("unusedBytecode");
            // remote push from temp vector
            case 0x8C:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                this.generatePush("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // remote store into temp vector
            case 0x8D:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                this.generateStoreInto("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // remote store and pop into temp vector
            case 0x8E:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                this.generatePopInto("temp[", 6 + byte3, "].pointers[", byte2, "]");
                return;
            // pushClosureCopy
            case 0x8F:
                var byte2 = this.method.bytes[this.pc++];
                var byte3 = this.method.bytes[this.pc++];
                var byte4 = this.method.bytes[this.pc++];
                var numArgs = byte2 & 0xF,
                    numCopied = byte2 >> 4,
                    blockSize = byte3 << 8 | byte4;
                this.generateClosureCopy(numArgs, numCopied, blockSize);
                return;
    	}
    },
    generatePush: function(value, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("push");
        this.generateLabel();
        this.source.push("stack[++vm.sp] = ", value);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(";\n");
    },
    generateStoreInto: function(value, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("store into");
        this.generateLabel();
        this.source.push(value);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = stack[vm.sp];\n");
    },
    generatePopInto: function(value, arg1, suffix1, arg2, suffix2) {
        if (this.debug) this.generateDebugCode("pop into");
        this.generateLabel();
        this.source.push(value);
        if (arg1 !== undefined) {
            this.source.push(arg1, suffix1);
            if (arg2 !== undefined) {
                this.source.push(arg2, suffix2);
            }
        }
        this.source.push(" = stack[vm.sp--];\n");
    },
    generateReturn: function(what) {
        if (this.debug) this.generateDebugCode("return");
        this.generateLabel();
        this.source.push(
            "vm.pc = ", this.pc, "; vm.doReturn(", what, "); return bytecodes + ", this.pc, ";\n");
        this.needsBreak = false; // returning anyway
        this.done = this.pc > this.endPC;
    },
    generateBlockReturn: function() {
        if (this.debug) this.generateDebugCode("block return");
        this.generateLabel();
        // actually stack === context.pointers but that would look weird
        this.source.push(
            "vm.pc = ", this.pc, "; vm.doReturn(stack[vm.sp--], context.pointers[0]); return bytecodes + ", this.pc, ";\n");
        this.needsBreak = false; // returning anyway
    },
    generateJump: function(distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump to " + destination);
        this.generateLabel();
        this.source.push("vm.pc = ", destination, "; ");
        if (distance < 0) this.source.push("bytecodes += ", -distance, "; ");
        else this.source.push("bytecodes -= ", distance, "; ");
        if (distance < 0) this.source.push(
            "\nif (vm.interruptCheckCounter-- <= 0) {\n",
            "   vm.checkForInterrupts();\n",
            "   if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", destination, ";\n",
            "}\n");
        if (this.singleStep) this.source.push("\nif (vm.breakOutOfInterpreter) return bytecodes + ", destination, ";\n");
        this.source.push("continue;\n");
        this.needsBreak = false; // already checked
        this.needsLabel[destination] = true;
        if (destination > this.endPC) this.endPC = destination;
    },
    generateJumpIf: function(condition, distance) {
        var destination = this.pc + distance;
        if (this.debug) this.generateDebugCode("jump if " + condition + " to " + destination);
        this.generateLabel();
        this.source.push(
            "var cond = stack[vm.sp--]; if (cond === vm.", condition, "Obj) {vm.pc = ", destination, "; bytecodes -= ", distance, "; ");
        if (this.singleStep) this.source.push("if (vm.breakOutOfInterpreter) return bytecodes + ", destination,"; else ");
        this.source.push("continue}\n",
            "else if (cond !== vm.", !condition, "Obj) {vm.sp++; vm.pc = ", this.pc, "; vm.send(vm.specialObjects[25], 0, false); return bytecodes + ", this.pc, "}\n");
        this.needsLabel[this.pc] = true; // for coming back after #mustBeBoolean send
        this.needsLabel[destination] = true; // obviously
        if (destination > this.endPC) this.endPC = destination;
    }
,
    generateQuickPrim: function(byte) {
        if (this.debug) this.generateDebugCode("quick prim " + this.specialSelectors[(byte & 0x0F) + 16]);
        this.generateLabel();
        switch (byte) {
            //case 0xC0: return this.popNandPushIfOK(2, this.objectAt(true,true,false)); // at:
            //case 0xC1: return this.popNandPushIfOK(3, this.objectAtPut(true,true,false)); // at:put:
            case 0xC2: // size
                this.source.push(
                    "if (stack[vm.sp].sqClass === vm.specialObjects[7]) stack[vm.sp] = stack[vm.sp].pointersSize();\n",
                    "else if (stack[vm.sp].sqClass === vm.specialObjects[6]) stack[vm.sp] = stack[vm.sp].bytesSize();\n",
                    "else { vm.pc = ", this.pc, "; vm.sendSpecial(18); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "; }\n"); 
                this.needsLabel[this.pc] = true;
                return;
            //case 0xC3: return false; // next
            //case 0xC4: return false; // nextPut:
            //case 0xC5: return false; // atEnd
            case 0xC6: // ==
                this.source.push("var cond = stack[vm.sp-1] === stack[vm.sp];\nstack[--vm.sp] = cond ? vm.trueObj : vm.falseObj;\n");
                return;
            case 0xC7: // class
                this.source.push("stack[vm.sp] = typeof stack[vm.sp] === 'number' ? vm.specialObjects[5] : stack[vm.sp].sqClass;\n");
                return;
            case 0xC8: // blockCopy:
                this.source.push(
                    "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), ")) ",
                    "{vm.sendSpecial(", ((byte & 0x0F) + 16), "); return bytecodes + ", this.pc, "}\n");
                this.needsLabel[this.pc] = true;        // for send
                this.needsLabel[this.pc + 2] = true;    // for start of block
                return;
            case 0xC9: // value
            case 0xCA: // value:
            case 0xCB: // do:
                this.source.push(
                    "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), ")) vm.sendSpecial(", ((byte & 0x0F) + 16), "); return bytecodes + ", this.pc, ";\n");
                this.needsLabel[this.pc] = true;
                return;
            //case 0xCC: return false; // new
            //case 0xCD: return false; // new:
            //case 0xCE: return false; // x
            //case 0xCF: return false; // y
        }
        // generic version for the bytecodes not yet handled above
        this.source.push(
            "vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(rcvr, ", (byte & 0x0F), "))",
            " vm.sendSpecial(", ((byte & 0x0F) + 16), ");\n",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n",
            "if (vm.pc !== ", this.pc, ") throw Error('Huh?');\n");
        this.needsBreak = false; // already checked
        // if falling back to a full send we need a label for coming back
        this.needsLabel[this.pc] = true;
    },
    generateNumericOp: function(byte) {
        if (this.debug) this.generateDebugCode("numeric op " + this.specialSelectors[byte & 0x0F]);
        this.generateLabel();
        // if the op cannot be executed here, do a full send and return to main loop
        // we need a label for coming back
        this.needsLabel[this.pc] = true;
        switch (byte) {
            case 0xB0: // PLUS +
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a + b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(0); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB1: // MINUS -
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = vm.primHandler.signed32BitIntegerFor(a - b);\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(1); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB2: // LESS <
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a < b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(2); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB3: // GRTR >
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a > b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(3); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB4: // LEQ <=
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a <= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(4); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB5: // GEQ >=
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a >= b ? vm.trueObj : vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(5); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB6: // EQU =
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a === b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b && a.float === a.float) {\n",   // NaN check
                "   stack[--vm.sp] = vm.trueObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(6); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB7: // NEQ ~=
                this.source.push("var a = stack[vm.sp - 1], b = stack[vm.sp];\n",
                "if (typeof a === 'number' && typeof b === 'number') {\n",
                "   stack[--vm.sp] = a !== b ? vm.trueObj : vm.falseObj;\n",
                "} else if (a === b && a.float === a.float) {\n",   // NaN check
                "   stack[--vm.sp] = vm.falseObj;\n",
                "} else { vm.pc = ", this.pc, "; vm.sendSpecial(7); if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB8: // TIMES *
                this.source.push("vm.success = true; vm.resultIsFloat = false; if(!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) * vm.stackIntOrFloat(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(8); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xB9: // DIV /
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.quickDivide(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(9); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBA: // MOD \
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.mod(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(10); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBB:  // MakePt int@int
                this.source.push("vm.success = true; if(!vm.primHandler.primitiveMakePoint(1, true)) { vm.pc = ", this.pc, "; vm.sendSpecial(11); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBC: // bitShift:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.safeShift(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(12); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBD: // Divide //
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.div(vm.stackInteger(1),vm.stackInteger(0)))) { vm.pc = ", this.pc, "; vm.sendSpecial(13); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBE: // bitAnd:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.stackInteger(1) & vm.stackInteger(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(14); return bytecodes + ", this.pc, "}\n");
                return;
            case 0xBF: // bitOr:
                this.source.push("vm.success = true; if(!vm.pop2AndPushIntResult(vm.stackInteger(1) | vm.stackInteger(0))) { vm.pc = ", this.pc, "; vm.sendSpecial(15); return bytecodes + ", this.pc, "}\n");
                return;
        }
    },
    generateSend: function(prefix, num, suffix, numArgs, superSend) {
        if (this.debug) this.generateDebugCode("send " + (prefix === "lit[" ? this.method.pointers[num].bytesAsString() : "..."));
        this.generateLabel();
        // set pc, activate new method, and return to main loop
        // unless the method was a successfull primitive call (no context change)
        this.source.push(
            "vm.pc = ", this.pc, "; vm.send(", prefix, num, suffix, ", ", numArgs, ", ", superSend, "); ",
            "if (context !== vm.activeContext || vm.breakOutOfInterpreter !== false) return bytecodes + ", this.pc, ";\n");
        this.needsBreak = false; // already checked
        // need a label for coming back after send
        this.needsLabel[this.pc] = true;
    },
    generateClosureTemps: function(count, popValues) {
        if (this.debug) this.generateDebugCode("closure temps");
        this.generateLabel();
        this.source.push("var array = vm.instantiateClass(vm.specialObjects[7], ", count, ");\n");
        if (popValues) {
            for (var i = 0; i < count; i++)
                this.source.push("array.pointers[", i, "] = stack[vm.sp - ", count - i - 1, "];\n");
            this.source.push("stack[vm.sp -= ", count - 1, "] = array;\n");
        } else {
            this.source.push("stack[++vm.sp] = array;\n");
        }
    },
    generateClosureCopy: function(numArgs, numCopied, blockSize) {
        var from = this.pc,
            to = from + blockSize;
        if (this.debug) this.generateDebugCode("push closure(" + from + "-" + (to-1) + "): " + numArgs + " args, " + numCopied + " captured");
        this.generateLabel();
        this.source.push(
            "var closure = vm.instantiateClass(vm.specialObjects[36], ", numCopied + 3, ");\n",
            "closure.pointers[0] = context; vm.reclaimableContextCount = 0;\n",
            "closure.pointers[1] = ", from + this.method.pointers.length * 4 + 1, ";\n",  // encodeSqueakPC
            "closure.pointers[2] = ", numArgs, ";\n");
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                this.source.push("closure.pointers[", i + 3, "] = stack[vm.sp - ", numCopied - i - 1,"];\n");
            this.source.push("stack[vm.sp -= ", numCopied - 1,"] = closure;\n");
        } else {
            this.source.push("stack[++vm.sp] = closure;\n");
        }
        this.source.push("vm.pc = ", to, ";\n");
        this.source.push("bytecodes -= ", blockSize, ";\n"); 
        if (this.singleStep) this.source.push("if (vm.breakOutOfInterpreter) return bytecodes + ", to,";\n");
        this.source.push("continue;\n");
        this.needsBreak = false; // already checked
        this.needsLabel[from] = true;   // initial pc when activated
        this.needsLabel[to] = true;     // for jump over closure
    	if (to > this.endPC) this.endPC = to;
    },
    generateLabel: function() {
        // remember label position for deleteUnneededLabels()
        this.sourceLabels[this.prevPC] = this.source.length;
        this.source.push("case ", this.prevPC, ":\n");
        this.prevPC = this.pc;
    },
    generateDebugCode: function(comment) {
        // single-step for previous instructiuon
        if (this.needsBreak) {
             this.source.push("if (vm.breakOutOfInterpreter) return bytecodes + (vm.pc = ", this.prevPC, ");\n");
             this.needsLabel[this.prevPC] = true;
        }
        // comment for this instructiuon
        var bytecodes = [];
        for (var i = this.prevPC; i < this.pc; i++)
            bytecodes.push((this.method.bytes[i] + 0x100).toString(16).slice(-2).toUpperCase());
        this.source.push("// ", this.prevPC, " <", bytecodes.join(" "), "> ", comment, "\n");
        // enable single-step for next instruction
        this.needsBreak = this.singleStep;
    },
    generateInstruction: function(comment, instr) {
        if (this.debug) this.generateDebugCode(comment); 
        this.generateLabel();
        this.source.push(instr, ";\n");
    },
    deleteUnneededLabels: function() {
        // switch statement is more efficient with fewer labels
        for (var i in this.sourceLabels) 
            if (!this.needsLabel[i])
                for (var j = 0; j < 3; j++) 
                    this.source[this.sourceLabels[i] + j] = "";
    },
});

}) // end of module

/***** including ../plugins/ADPCMCodecPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:20 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	ADPCMCodecPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.ADPCMCodecPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var bitPosition = 0;
var byteIndex = 0;
var currentByte = 0;
var encodedBytes = null;
var interpreterProxy = null;
var moduleName = "ADPCMCodecPlugin 3 November 2014 (e)";
var stepSizeTable = null;



/*	Note: This is coded so that plugins can be run from Squeak. */

function getInterpreter() {
	return interpreterProxy;
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}


/*	Answer the best index to use for the difference between the given samples. */
/*	Details: Scan stepSizeTable for the first entry >= the absolute value of the difference between sample values. Since indexes are zero-based, the index used during decoding will be the one in the following stepSizeTable entry. Since the index field of a Flash frame header is only six bits, the maximum index value is 63. */
/*	Note: Since there does not appear to be any documentation of how Flash actually computes the indices used in its frame headers, this algorithm was guessed by reverse-engineering the Flash ADPCM decoder. */

function indexForDeltaFromto(thisSample, nextSample) {
	var bestIndex;
	var diff;
	var j;

	diff = nextSample - thisSample;
	if (diff < 0) {
		diff = 0 - diff;
	}
	bestIndex = 63;
	for (j = 1; j <= 62; j++) {
		if (bestIndex === 63) {
			if (stepSizeTable[j - 1] >= diff) {
				bestIndex = j;
			}
		}
	}
	return bestIndex;
}

function msg(s) {
	console.log(moduleName + ": " + s);
}


/*	Answer the next n bits of my bit stream as an unsigned integer. */

function nextBits(n) {
	var remaining;
	var result;
	var shift;

	result = 0;
	remaining = n;
	while(true) {
		shift = remaining - bitPosition;
		if (shift > 0) {

			/* consumed currentByte buffer; fetch next byte */

			result += SHL(currentByte, shift);
			remaining -= bitPosition;
			currentByte = encodedBytes[((++byteIndex)) - 1];
			bitPosition = 8;
		} else {

			/* still some bits left in currentByte buffer */

			result += SHR(currentByte, (0 - shift));

			/* mask out the consumed bits: */

			bitPosition -= remaining;
			currentByte = currentByte & (SHR(255, (8 - bitPosition)));
			return result;
		}
	}
}


/*	Write the next n bits to my bit stream. */

function nextBitsput(n, anInteger) {
	var bitsAvailable;
	var buf;
	var bufBits;
	var shift;

	buf = anInteger;
	bufBits = n;
	while(true) {
		bitsAvailable = 8 - bitPosition;

		/* either left or right shift */
		/* append high bits of buf to end of currentByte: */

		shift = bitsAvailable - bufBits;
		if (shift < 0) {

			/* currentByte buffer filled; output it */

			currentByte += SHR(buf, (0 - shift));
			encodedBytes[((++byteIndex)) - 1] = currentByte;
			bitPosition = 0;

			/* clear saved high bits of buf: */

			currentByte = 0;
			buf = buf & ((SHL(1, (0 - shift))) - 1);
			bufBits -= bitsAvailable;
		} else {

			/* still some bits available in currentByte buffer */

			currentByte += SHL(buf, shift);
			bitPosition += bufBits;
			return self;
		}
	}
}

function primitiveDecodeMono() {
	var rcvr;
	var count;
	var bit;
	var delta;
	var i;
	var predictedDelta;
	var step;
	var bitsPerSample;
	var deltaSignMask;
	var deltaValueHighBit;
	var deltaValueMask;
	var frameSizeMask;
	var index;
	var indexTable;
	var predicted;
	var sampleIndex;
	var samples;

	rcvr = interpreterProxy.stackValue(1);
	count = interpreterProxy.stackIntegerValue(0);
	predicted = interpreterProxy.fetchIntegerofObject(0, rcvr);
	index = interpreterProxy.fetchIntegerofObject(1, rcvr);
	deltaSignMask = interpreterProxy.fetchIntegerofObject(2, rcvr);
	deltaValueMask = interpreterProxy.fetchIntegerofObject(3, rcvr);
	deltaValueHighBit = interpreterProxy.fetchIntegerofObject(4, rcvr);
	frameSizeMask = interpreterProxy.fetchIntegerofObject(5, rcvr);
	currentByte = interpreterProxy.fetchIntegerofObject(6, rcvr);
	bitPosition = interpreterProxy.fetchIntegerofObject(7, rcvr);
	byteIndex = interpreterProxy.fetchIntegerofObject(8, rcvr);
	encodedBytes = interpreterProxy.fetchBytesofObject(9, rcvr);
	samples = interpreterProxy.fetchInt16ArrayofObject(10, rcvr);
	sampleIndex = interpreterProxy.fetchIntegerofObject(12, rcvr);
	bitsPerSample = interpreterProxy.fetchIntegerofObject(13, rcvr);
	stepSizeTable = interpreterProxy.fetchInt16ArrayofObject(14, rcvr);
	indexTable = interpreterProxy.fetchInt16ArrayofObject(15, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (i = 1; i <= count; i++) {
		if ((i & frameSizeMask) === 1) {

			/* start of frame; read frame header */

			predicted = nextBits(16);
			if (predicted > 32767) {
				predicted -= 65536;
			}
			index = nextBits(6);
			samples[((++sampleIndex)) - 1] = predicted;
		} else {
			delta = nextBits(bitsPerSample);
			step = stepSizeTable[index];
			predictedDelta = 0;
			bit = deltaValueHighBit;
			while (bit > 0) {
				if ((delta & bit) > 0) {
					predictedDelta += step;
				}
				step = step >>> 1;
				bit = bit >>> 1;
			}
			predictedDelta += step;
			if ((delta & deltaSignMask) > 0) {
				predicted -= predictedDelta;
			} else {
				predicted += predictedDelta;
			}
			if (predicted > 32767) {
				predicted = 32767;
			} else {
				if (predicted < -32768) {
					predicted = -32768;
				}
			}
			index += indexTable[delta & deltaValueMask];
			if (index < 0) {
				index = 0;
			} else {
				if (index > 88) {
					index = 88;
				}
			}
			samples[((++sampleIndex)) - 1] = predicted;
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(0, rcvr, predicted);
	interpreterProxy.storeIntegerofObjectwithValue(1, rcvr, index);
	interpreterProxy.storeIntegerofObjectwithValue(6, rcvr, currentByte);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, bitPosition);
	interpreterProxy.storeIntegerofObjectwithValue(8, rcvr, byteIndex);
	interpreterProxy.storeIntegerofObjectwithValue(12, rcvr, sampleIndex);
	interpreterProxy.pop(1);
}

function primitiveDecodeStereo() {
	var rcvr;
	var count;
	var bit;
	var deltaLeft;
	var deltaRight;
	var i;
	var indexLeft;
	var indexRight;
	var predictedDeltaLeft;
	var predictedDeltaRight;
	var predictedLeft;
	var predictedRight;
	var stepLeft;
	var stepRight;
	var bitsPerSample;
	var deltaSignMask;
	var deltaValueHighBit;
	var deltaValueMask;
	var frameSizeMask;
	var index;
	var indexTable;
	var predicted;
	var rightSamples;
	var sampleIndex;
	var samples;


	/* make local copies of decoder state variables */

	rcvr = interpreterProxy.stackValue(1);
	count = interpreterProxy.stackIntegerValue(0);
	predicted = interpreterProxy.fetchInt16ArrayofObject(0, rcvr);
	index = interpreterProxy.fetchInt16ArrayofObject(1, rcvr);
	deltaSignMask = interpreterProxy.fetchIntegerofObject(2, rcvr);
	deltaValueMask = interpreterProxy.fetchIntegerofObject(3, rcvr);
	deltaValueHighBit = interpreterProxy.fetchIntegerofObject(4, rcvr);
	frameSizeMask = interpreterProxy.fetchIntegerofObject(5, rcvr);
	currentByte = interpreterProxy.fetchIntegerofObject(6, rcvr);
	bitPosition = interpreterProxy.fetchIntegerofObject(7, rcvr);
	byteIndex = interpreterProxy.fetchIntegerofObject(8, rcvr);
	encodedBytes = interpreterProxy.fetchBytesofObject(9, rcvr);
	samples = interpreterProxy.fetchInt16ArrayofObject(10, rcvr);
	rightSamples = interpreterProxy.fetchInt16ArrayofObject(11, rcvr);
	sampleIndex = interpreterProxy.fetchIntegerofObject(12, rcvr);
	bitsPerSample = interpreterProxy.fetchIntegerofObject(13, rcvr);
	stepSizeTable = interpreterProxy.fetchInt16ArrayofObject(14, rcvr);
	indexTable = interpreterProxy.fetchInt16ArrayofObject(15, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	predictedLeft = predicted[1 - 1];
	predictedRight = predicted[2 - 1];
	indexLeft = index[1 - 1];
	indexRight = index[2 - 1];
	for (i = 1; i <= count; i++) {
		if ((i & frameSizeMask) === 1) {

			/* start of frame; read frame header */

			predictedLeft = nextBits(16);
			indexLeft = nextBits(6);
			predictedRight = nextBits(16);
			indexRight = nextBits(6);
			if (predictedLeft > 32767) {
				predictedLeft -= 65536;
			}
			if (predictedRight > 32767) {
				predictedRight -= 65536;
			}
			samples[((++sampleIndex)) - 1] = predictedLeft;
			rightSamples[sampleIndex - 1] = predictedRight;
		} else {
			deltaLeft = nextBits(bitsPerSample);
			deltaRight = nextBits(bitsPerSample);
			stepLeft = stepSizeTable[indexLeft];
			stepRight = stepSizeTable[indexRight];
			predictedDeltaLeft = (predictedDeltaRight = 0);
			bit = deltaValueHighBit;
			while (bit > 0) {
				if ((deltaLeft & bit) > 0) {
					predictedDeltaLeft += stepLeft;
				}
				if ((deltaRight & bit) > 0) {
					predictedDeltaRight += stepRight;
				}
				stepLeft = stepLeft >>> 1;
				stepRight = stepRight >>> 1;
				bit = bit >>> 1;
			}
			predictedDeltaLeft += stepLeft;
			predictedDeltaRight += stepRight;
			if ((deltaLeft & deltaSignMask) > 0) {
				predictedLeft -= predictedDeltaLeft;
			} else {
				predictedLeft += predictedDeltaLeft;
			}
			if ((deltaRight & deltaSignMask) > 0) {
				predictedRight -= predictedDeltaRight;
			} else {
				predictedRight += predictedDeltaRight;
			}
			if (predictedLeft > 32767) {
				predictedLeft = 32767;
			} else {
				if (predictedLeft < -32768) {
					predictedLeft = -32768;
				}
			}
			if (predictedRight > 32767) {
				predictedRight = 32767;
			} else {
				if (predictedRight < -32768) {
					predictedRight = -32768;
				}
			}
			indexLeft += indexTable[deltaLeft & deltaValueMask];
			if (indexLeft < 0) {
				indexLeft = 0;
			} else {
				if (indexLeft > 88) {
					indexLeft = 88;
				}
			}
			indexRight += indexTable[deltaRight & deltaValueMask];
			if (indexRight < 0) {
				indexRight = 0;
			} else {
				if (indexRight > 88) {
					indexRight = 88;
				}
			}
			samples[((++sampleIndex)) - 1] = predictedLeft;
			rightSamples[sampleIndex - 1] = predictedRight;
		}
	}
	predicted[1 - 1] = predictedLeft;
	predicted[2 - 1] = predictedRight;
	index[1 - 1] = indexLeft;
	index[2 - 1] = indexRight;
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(6, rcvr, currentByte);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, bitPosition);
	interpreterProxy.storeIntegerofObjectwithValue(8, rcvr, byteIndex);
	interpreterProxy.storeIntegerofObjectwithValue(12, rcvr, sampleIndex);
	interpreterProxy.pop(1);
}

function primitiveEncodeMono() {
	var rcvr;
	var count;
	var bit;
	var delta;
	var diff;
	var i;
	var p;
	var predictedDelta;
	var sign;
	var step;
	var bitsPerSample;
	var deltaSignMask;
	var deltaValueHighBit;
	var frameSizeMask;
	var index;
	var indexTable;
	var predicted;
	var sampleIndex;
	var samples;

	rcvr = interpreterProxy.stackValue(1);
	count = interpreterProxy.stackIntegerValue(0);
	predicted = interpreterProxy.fetchIntegerofObject(0, rcvr);
	index = interpreterProxy.fetchIntegerofObject(1, rcvr);
	deltaSignMask = interpreterProxy.fetchIntegerofObject(2, rcvr);
	deltaValueHighBit = interpreterProxy.fetchIntegerofObject(4, rcvr);
	frameSizeMask = interpreterProxy.fetchIntegerofObject(5, rcvr);
	currentByte = interpreterProxy.fetchIntegerofObject(6, rcvr);
	bitPosition = interpreterProxy.fetchIntegerofObject(7, rcvr);
	byteIndex = interpreterProxy.fetchIntegerofObject(8, rcvr);
	encodedBytes = interpreterProxy.fetchBytesofObject(9, rcvr);
	samples = interpreterProxy.fetchInt16ArrayofObject(10, rcvr);
	sampleIndex = interpreterProxy.fetchIntegerofObject(12, rcvr);
	bitsPerSample = interpreterProxy.fetchIntegerofObject(13, rcvr);
	stepSizeTable = interpreterProxy.fetchInt16ArrayofObject(14, rcvr);
	indexTable = interpreterProxy.fetchInt16ArrayofObject(15, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	step = stepSizeTable[1 - 1];
	for (i = 1; i <= count; i++) {
		if ((i & frameSizeMask) === 1) {
			predicted = samples[((++sampleIndex)) - 1];
			if (((p = predicted)) < 0) {
				p += 65536;
			}
			nextBitsput(16, p);
			if (i < count) {
				index = indexForDeltaFromto(predicted, samples[sampleIndex]);
			}
			nextBitsput(6, index);
		} else {

			/* compute sign and magnitude of difference from the predicted sample */

			sign = 0;
			diff = samples[((++sampleIndex)) - 1] - predicted;
			if (diff < 0) {
				sign = deltaSignMask;
				diff = 0 - diff;
			}
			delta = 0;
			predictedDelta = 0;
			bit = deltaValueHighBit;
			while (bit > 0) {
				if (diff >= step) {
					delta += bit;
					predictedDelta += step;
					diff -= step;
				}
				step = step >>> 1;
				bit = bit >>> 1;
			}

			/* compute and clamp new prediction */

			predictedDelta += step;
			if (sign > 0) {
				predicted -= predictedDelta;
			} else {
				predicted += predictedDelta;
			}
			if (predicted > 32767) {
				predicted = 32767;
			} else {
				if (predicted < -32768) {
					predicted = -32768;
				}
			}
			index += indexTable[delta];
			if (index < 0) {
				index = 0;
			} else {
				if (index > 88) {
					index = 88;
				}
			}

			/* output encoded, signed delta */

			step = stepSizeTable[index];
			nextBitsput(bitsPerSample, sign | delta);
		}
	}
	if (bitPosition > 0) {

		/* flush the last output byte, if necessary */

		encodedBytes[((++byteIndex)) - 1] = currentByte;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(0, rcvr, predicted);
	interpreterProxy.storeIntegerofObjectwithValue(1, rcvr, index);
	interpreterProxy.storeIntegerofObjectwithValue(6, rcvr, currentByte);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, bitPosition);
	interpreterProxy.storeIntegerofObjectwithValue(8, rcvr, byteIndex);
	interpreterProxy.storeIntegerofObjectwithValue(12, rcvr, sampleIndex);
	interpreterProxy.pop(1);
}


/*	not yet implemented */

function primitiveEncodeStereo() {
	var rcvr;
	var count;

	rcvr = interpreterProxy.stackValue(1);
	count = interpreterProxy.stackIntegerValue(0);
	currentByte = interpreterProxy.fetchIntegerofObject(6, rcvr);
	bitPosition = interpreterProxy.fetchIntegerofObject(7, rcvr);
	byteIndex = interpreterProxy.fetchIntegerofObject(8, rcvr);
	encodedBytes = interpreterProxy.fetchIntegerofObject(9, rcvr);
	stepSizeTable = interpreterProxy.fetchIntegerofObject(14, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	success(false);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(6, rcvr, currentByte);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, bitPosition);
	interpreterProxy.storeIntegerofObjectwithValue(8, rcvr, byteIndex);
	interpreterProxy.pop(1);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


Squeak.registerExternalModule("ADPCMCodecPlugin", {
	primitiveDecodeStereo: primitiveDecodeStereo,
	primitiveEncodeStereo: primitiveEncodeStereo,
	setInterpreter: setInterpreter,
	primitiveEncodeMono: primitiveEncodeMono,
	primitiveDecodeMono: primitiveDecodeMono,
	getModuleName: getModuleName,
});

}); // end of module

/***** including ../plugins/BitBltPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:20 pm */
/* Automatically generated by
	JSSmartSyntaxPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	BitBltSimulation VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.BitBltPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Constants ***/
var AllOnes = 4294967295;
var AlphaIndex = 3;
var BBClipHeightIndex = 13;
var BBClipWidthIndex = 12;
var BBClipXIndex = 10;
var BBClipYIndex = 11;
var BBColorMapIndex = 14;
var BBDestFormIndex = 0;
var BBDestXIndex = 4;
var BBDestYIndex = 5;
var BBHalftoneFormIndex = 2;
var BBHeightIndex = 7;
var BBRuleIndex = 3;
var BBSourceFormIndex = 1;
var BBSourceXIndex = 8;
var BBSourceYIndex = 9;
var BBWarpBase = 15;
var BBWidthIndex = 6;
var BinaryPoint = 14;
var BlueIndex = 2;
var ColorMapFixedPart = 2;
var ColorMapIndexedPart = 4;
var ColorMapNewStyle = 8;
var ColorMapPresent = 1;
var FixedPt1 = 16384;
var FormBitsIndex = 0;
var FormDepthIndex = 3;
var FormHeightIndex = 2;
var FormWidthIndex = 1;
var GreenIndex = 1;
var OpTableSize = 43;
var RedIndex = 0;

/*** Variables ***/
var affectedB = 0;
var affectedL = 0;
var affectedR = 0;
var affectedT = 0;
var bbH = 0;
var bbW = 0;
var bitBltOop = 0;
var bitCount = 0;
var clipHeight = 0;
var clipWidth = 0;
var clipX = 0;
var clipY = 0;
var cmBitsPerColor = 0;
var cmFlags = 0;
var cmLookupTable = null;
var cmMask = 0;
var cmMaskTable = null;
var cmShiftTable = null;
var combinationRule = 0;
var componentAlphaModeAlpha = 0;
var componentAlphaModeColor = 0;
var destBits = 0;
var destDelta = 0;
var destDepth = 0;
var destForm = 0;
var destHeight = 0;
var destIndex = 0;
var destMSB = 0;
var destMask = 0;
var destPPW = 0;
var destPitch = 0;
var destWidth = 0;
var destX = 0;
var destY = 0;
var dither8Lookup = new Array(4096);
var ditherMatrix4x4 = [
0,	8,	2,	10,
12,	4,	14,	6,
3,	11,	1,	9,
15,	7,	13,	5
];
var ditherThresholds16 = [ 0, 2, 4, 6, 8, 12, 14, 16 ];
var ditherValues16 = [
0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
];
var dstBitShift = 0;
var dx = 0;
var dy = 0;
var gammaLookupTable = null;
var hDir = 0;
var halftoneBase = 0;
var halftoneForm = 0;
var halftoneHeight = 0;
var hasSurfaceLock = 0;
var height = 0;
var interpreterProxy = null;
var isWarping = 0;
var lockSurfaceFn = null;
var mask1 = 0;
var mask2 = 0;
var maskTable = [
0, 1, 3, 0, 15, 31, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 65535,
0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1
];
var moduleName = "BitBltPlugin 3 November 2014 (e)";
var nWords = 0;
var noHalftone = 0;
var noSource = 0;
var opTable = new Array(43);
var preload = 0;
var querySurfaceFn = null;
var skew = 0;
var sourceAlpha = 0;
var sourceBits = 0;
var sourceDelta = 0;
var sourceDepth = 0;
var sourceForm = 0;
var sourceHeight = 0;
var sourceIndex = 0;
var sourceMSB = 0;
var sourcePPW = 0;
var sourcePitch = 0;
var sourceWidth = 0;
var sourceX = 0;
var sourceY = 0;
var srcBitShift = 0;
var sx = 0;
var sy = 0;
var ungammaLookupTable = null;
var unlockSurfaceFn = null;
var vDir = 0;
var warpAlignMask = 0;
var warpAlignShift = 0;
var warpBitShiftTable = new Array(32);
var warpSrcMask = 0;
var warpSrcShift = 0;
var width = 0;



/*	Subract the pixels in the source and destination, color by color,
	and return the sum of the absolute value of all the differences.
	For non-rgb, XOR the two and return the number of differing pixels.
	Note that the region is not clipped to bit boundaries, but only to the
	nearest (enclosing) word.  This is because copyLoop does not do
	pre-merge masking.  For accurate results, you must subtract the
	values obtained from the left and right fringes. */

function OLDrgbDiffwith(sourceWord, destinationWord) {
	var diff;
	var pixMask;

	if (destDepth < 16) {

		/* Just xor and count differing bits if not RGB */

		diff = sourceWord ^ destinationWord;
		pixMask = maskTable[destDepth];
		while (!(diff === 0)) {
			if ((diff & pixMask) !== 0) {
				++bitCount;
			}
			diff = SHR(diff, destDepth);
		}
		return destinationWord;
	}
	if (destDepth === 16) {
		diff = partitionedSubfromnBitsnPartitions(sourceWord, destinationWord, 5, 3);
		bitCount = ((bitCount + (diff & 31)) + ((diff >>> 5) & 31)) + ((diff >>> 10) & 31);
		diff = partitionedSubfromnBitsnPartitions(sourceWord >>> 16, destinationWord >>> 16, 5, 3);
		bitCount = ((bitCount + (diff & 31)) + ((diff >>> 5) & 31)) + ((diff >>> 10) & 31);
	} else {
		diff = partitionedSubfromnBitsnPartitions(sourceWord, destinationWord, 8, 3);
		bitCount = ((bitCount + (diff & 255)) + ((diff >>> 8) & 255)) + ((diff >>> 16) & 255);
	}
	return destinationWord;
}


/*	Tally pixels into the color map.  Note that the source should be 
	specified = destination, in order for the proper color map checks 
	to be performed at setup.
	Note that the region is not clipped to bit boundaries, but only to the
	nearest (enclosing) word.  This is because copyLoop does not do
	pre-merge masking.  For accurate results, you must subtract the
	values obtained from the left and right fringes. */

function OLDtallyIntoMapwith(sourceWord, destinationWord) {
	var pixMask;
	var mapIndex;
	var i;
	var shiftWord;

	if ((cmFlags & (ColorMapPresent | ColorMapIndexedPart)) !== (ColorMapPresent | ColorMapIndexedPart)) {
		return destinationWord;
	}
	if (destDepth < 16) {

		/* loop through all packed pixels. */

		pixMask = maskTable[destDepth] & cmMask;
		shiftWord = destinationWord;
		for (i = 1; i <= destPPW; i++) {
			mapIndex = shiftWord & pixMask;
			tallyMapAtput(mapIndex, tallyMapAt(mapIndex) + 1);
			shiftWord = SHR(shiftWord, destDepth);
		}
		return destinationWord;
	}
	if (destDepth === 16) {

		/* Two pixels  Tally the right half... */

		mapIndex = rgbMapfromto(destinationWord & 65535, 5, cmBitsPerColor);
		tallyMapAtput(mapIndex, tallyMapAt(mapIndex) + 1);
		mapIndex = rgbMapfromto(destinationWord >>> 16, 5, cmBitsPerColor);
		tallyMapAtput(mapIndex, tallyMapAt(mapIndex) + 1);
	} else {

		/* Just one pixel. */

		mapIndex = rgbMapfromto(destinationWord, 8, cmBitsPerColor);
		tallyMapAtput(mapIndex, tallyMapAt(mapIndex) + 1);
	}
	return destinationWord;
}

function addWordwith(sourceWord, destinationWord) {
	return sourceWord + destinationWord;
}


/*	Blend sourceWord with destinationWord, assuming both are 32-bit pixels.
	The source is assumed to have 255*alpha in the high 8 bits of each pixel,
	while the high 8 bits of the destinationWord will be ignored.
	The blend produced is alpha*source + (1-alpha)*dest, with
	the computation being performed independently on each color
	component.  The high byte of the result will be 0. */

function alphaBlendwith(sourceWord, destinationWord) {
	var unAlpha;
	var blendRB;
	var blendAG;
	var result;
	var alpha;


	/* High 8 bits of source pixel */

	alpha = sourceWord >>> 24;
	if (alpha === 0) {
		return destinationWord;
	}
	if (alpha === 255) {
		return sourceWord;
	}
	unAlpha = 255 - alpha;

	/* blend red and blue */

	blendRB = (((sourceWord & 16711935) * alpha) + ((destinationWord & 16711935) * unAlpha)) + 16711935;

	/* blend alpha and green */

	blendAG = (((((sourceWord >>> 8) | 16711680) & 16711935) * alpha) + (((destinationWord >>> 8) & 16711935) * unAlpha)) + 16711935;

	/* divide by 255 */

	blendRB = ((blendRB + (((blendRB - 65537) >>> 8) & 16711935)) >>> 8) & 16711935;
	blendAG = ((blendAG + (((blendAG - 65537) >>> 8) & 16711935)) >>> 8) & 16711935;
	result = blendRB | (blendAG << 8);
	return result;
}

function alphaBlendConstwith(sourceWord, destinationWord) {
	return alphaBlendConstwithpaintMode(sourceWord, destinationWord, false);
}


/*	Blend sourceWord with destinationWord using a constant alpha.
	Alpha is encoded as 0 meaning 0.0, and 255 meaning 1.0.
	The blend produced is alpha*source + (1.0-alpha)*dest, with the
	computation being performed independently on each color component.
	This function could eventually blend into any depth destination,
	using the same color averaging and mapping as warpBlt.
	paintMode = true means do nothing if the source pixel value is zero. */
/*	This first implementation works with dest depths of 16 and 32 bits only.
	Normal color mapping will allow sources of lower depths in this case,
	and results can be mapped directly by truncation, so no extra color maps are needed.
	To allow storing into any depth will require subsequent addition of two other
	colormaps, as is the case with WarpBlt. */

function alphaBlendConstwithpaintMode(sourceWord, destinationWord, paintMode) {
	var rgbMask;
	var pixMask;
	var pixBlend;
	var j;
	var sourceShifted;
	var result;
	var shift;
	var sourcePixVal;
	var i;
	var unAlpha;
	var destPixVal;
	var blendRB;
	var blendAG;
	var bitsPerColor;
	var blend;
	var destShifted;
	var maskShifted;

	if (destDepth < 16) {
		return destinationWord;
	}
	unAlpha = 255 - sourceAlpha;
	result = destinationWord;
	if (destPPW === 1) {

		/* 32bpp blends include alpha */

		if (!(paintMode && (sourceWord === 0))) {

			/* painting a transparent pixel */


			/* blendRB red and blue */

			blendRB = (((sourceWord & 16711935) * sourceAlpha) + ((destinationWord & 16711935) * unAlpha)) + 16711935;

			/* blendRB alpha and green */

			blendAG = ((((sourceWord >>> 8) & 16711935) * sourceAlpha) + (((destinationWord >>> 8) & 16711935) * unAlpha)) + 16711935;

			/* divide by 255 */

			blendRB = ((blendRB + (((blendRB - 65537) >>> 8) & 16711935)) >>> 8) & 16711935;
			blendAG = ((blendAG + (((blendAG - 65537) >>> 8) & 16711935)) >>> 8) & 16711935;
			result = blendRB | (blendAG << 8);
		}
	} else {
		pixMask = maskTable[destDepth];
		bitsPerColor = 5;
		rgbMask = 31;
		maskShifted = destMask;
		destShifted = destinationWord;
		sourceShifted = sourceWord;
		for (j = 1; j <= destPPW; j++) {
			sourcePixVal = sourceShifted & pixMask;
			if (!(((maskShifted & pixMask) === 0) || (paintMode && (sourcePixVal === 0)))) {
				destPixVal = destShifted & pixMask;
				pixBlend = 0;
				for (i = 1; i <= 3; i++) {
					shift = (i - 1) * bitsPerColor;
					blend = (DIV((((((SHR(sourcePixVal, shift)) & rgbMask) * sourceAlpha) + (((SHR(destPixVal, shift)) & rgbMask) * unAlpha)) + 254), 255)) & rgbMask;
					pixBlend = pixBlend | (SHL(blend, shift));
				}
				result = (result & ~(SHL(pixMask, ((j - 1) * 16)))) | (SHL(pixBlend, ((j - 1) * 16)));
			}
			maskShifted = SHR(maskShifted, destDepth);
			sourceShifted = SHR(sourceShifted, destDepth);
			destShifted = SHR(destShifted, destDepth);
		}
	}
	return result;
}


/*	Blend sourceWord with destinationWord using the alpha value from sourceWord.
	Alpha is encoded as 0 meaning 0.0, and 255 meaning 1.0.
	In contrast to alphaBlend:with: the color produced is

		srcColor + (1-srcAlpha) * dstColor

	e.g., it is assumed that the source color is already scaled. */

function alphaBlendScaledwith(sourceWord, destinationWord) {
	var unAlpha;
	var rb;
	var ag;


	/* Do NOT inline this into optimized loops */


	/* High 8 bits of source pixel is source opacity (ARGB format) */

	unAlpha = 255 - (sourceWord >>> 24);

	/* blend red and blue components */

	rb = ((((destinationWord & 16711935) * unAlpha) >>> 8) & 16711935) + (sourceWord & 16711935);

	/* blend alpha and green components */

	ag = (((((destinationWord >>> 8) & 16711935) * unAlpha) >>> 8) & 16711935) + ((sourceWord >>> 8) & 16711935);

	/* saturate red and blue components if there is a carry */

	rb = (rb & 16711935) | (((rb & 16777472) * 255) >>> 8);

	/* saturate alpha and green components if there is a carry */

	ag = ((ag & 16711935) << 8) | ((ag & 16777472) * 255);
	return ag | rb;
}

function alphaPaintConstwith(sourceWord, destinationWord) {
	if (sourceWord === 0) {
		return destinationWord;
	}
	return alphaBlendConstwithpaintMode(sourceWord, destinationWord, true);
}


/*	This version assumes 
		combinationRule = 34
		sourcePixSize = 32
		destPixSize = 16
		sourceForm ~= destForm.
	 */

function alphaSourceBlendBits16() {
	var ditherBase;
	var ditherThreshold;
	var srcShift;
	var sourceWord;
	var srcIndex;
	var deltaX;
	var dstIndex;
	var srcAlpha;
	var dstMask;
	var deltaY;
	var srcY;
	var destWord;
	var dstY;
	var ditherIndex;


	/* This particular method should be optimized in itself */


	/* So we can pre-decrement */

	deltaY = bbH + 1;
	srcY = sy;
	dstY = dy;
	srcShift = (dx & 1) * 16;
	if (destMSB) {
		srcShift = 16 - srcShift;
	}

	/* This is the outer loop */

	mask1 = SHL(65535, (16 - srcShift));
	while (((--deltaY)) !== 0) {
		srcIndex = ((srcY * sourcePitch)) + (sx * 4);
		dstIndex = ((dstY * destPitch)) + ((dx >> 1) * 4);
		ditherBase = (dstY & 3) * 4;

		/* For pre-increment */

		ditherIndex = (sx & 3) - 1;

		/* So we can pre-decrement */

		deltaX = bbW + 1;
		dstMask = mask1;
		if (dstMask === 65535) {
			srcShift = 16;
		} else {
			srcShift = 0;
		}
		while (((--deltaX)) !== 0) {
			ditherThreshold = ditherMatrix4x4[ditherBase + ((ditherIndex = (ditherIndex + 1) & 3))];
			sourceWord = sourceBits[srcIndex >>> 2];
			srcAlpha = sourceWord >>> 24;
			if (srcAlpha === 255) {

				/* Dither from 32 to 16 bit */

				sourceWord = dither32To16threshold(sourceWord, ditherThreshold);
				if (sourceWord === 0) {
					sourceWord = SHL(1, srcShift);
				} else {
					sourceWord = SHL(sourceWord, srcShift);
				}
				dstLongAtputmask(dstIndex, sourceWord, dstMask);
			} else {

				/* srcAlpha ~= 255 */

				if (srcAlpha !== 0) {

					/* 0 < srcAlpha < 255 */
					/* If we have to mix colors then just copy a single word */

					destWord = destBits[dstIndex >>> 2];
					destWord = destWord & ~dstMask;

					/* Expand from 16 to 32 bit by adding zero bits */

					destWord = SHR(destWord, srcShift);

					/* Mix colors */

					destWord = (((destWord & 31744) << 9) | ((destWord & 992) << 6)) | (((destWord & 31) << 3) | 4278190080);

					/* And dither */

					sourceWord = alphaBlendScaledwith(sourceWord, destWord);
					sourceWord = dither32To16threshold(sourceWord, ditherThreshold);
					if (sourceWord === 0) {
						sourceWord = SHL(1, srcShift);
					} else {
						sourceWord = SHL(sourceWord, srcShift);
					}
					dstLongAtputmask(dstIndex, sourceWord, dstMask);
				}
			}
			srcIndex += 4;
			if (destMSB) {
				if (srcShift === 0) {
					dstIndex += 4;
				}
			} else {
				if (srcShift !== 0) {
					dstIndex += 4;
				}
			}

			/* Toggle between 0 and 16 */

			srcShift = srcShift ^ 16;
			dstMask = ~dstMask;
		}
		++srcY;
		++dstY;
	}
}


/*	This version assumes 
		combinationRule = 34
		sourcePixSize = destPixSize = 32
		sourceForm ~= destForm.
	Note: The inner loop has been optimized for dealing
		with the special cases of srcAlpha = 0.0 and srcAlpha = 1.0 
	 */

function alphaSourceBlendBits32() {
	var sourceWord;
	var srcIndex;
	var deltaX;
	var dstIndex;
	var srcAlpha;
	var deltaY;
	var srcY;
	var destWord;
	var dstY;


	/* This particular method should be optimized in itself */
	/* Give the compile a couple of hints */
	/* The following should be declared as pointers so the compiler will
	notice that they're used for accessing memory locations 
	(good to know on an Intel architecture) but then the increments
	would be different between ST code and C code so must hope the
	compiler notices what happens (MS Visual C does) */


	/* So we can pre-decrement */

	deltaY = bbH + 1;
	srcY = sy;

	/* This is the outer loop */

	dstY = dy;
	while (((--deltaY)) !== 0) {
		srcIndex = ((srcY * sourcePitch)) + (sx * 4);
		dstIndex = ((dstY * destPitch)) + (dx * 4);

		/* So we can pre-decrement */
		/* This is the inner loop */

		deltaX = bbW + 1;
		while (((--deltaX)) !== 0) {
			sourceWord = sourceBits[srcIndex >>> 2];
			srcAlpha = sourceWord >>> 24;
			if (srcAlpha === 255) {
				destBits[dstIndex >>> 2] = sourceWord;
				srcIndex += 4;

				/* Now copy as many words as possible with alpha = 255 */

				dstIndex += 4;
				while ((((--deltaX)) !== 0) && ((((sourceWord = sourceBits[srcIndex >>> 2])) >>> 24) === 255)) {
					destBits[dstIndex >>> 2] = sourceWord;
					srcIndex += 4;
					dstIndex += 4;
				}
				++deltaX;
			} else {

				/* srcAlpha ~= 255 */

				if (srcAlpha === 0) {
					srcIndex += 4;

					/* Now skip as many words as possible, */

					dstIndex += 4;
					while ((((--deltaX)) !== 0) && ((((sourceWord = sourceBits[srcIndex >>> 2])) >>> 24) === 0)) {
						srcIndex += 4;
						dstIndex += 4;
					}
					++deltaX;
				} else {

					/* 0 < srcAlpha < 255 */
					/* If we have to mix colors then just copy a single word */

					destWord = destBits[dstIndex >>> 2];
					destWord = alphaBlendScaledwith(sourceWord, destWord);
					destBits[dstIndex >>> 2] = destWord;
					srcIndex += 4;
					dstIndex += 4;
				}
			}
		}
		++srcY;
		++dstY;
	}
}


/*	This version assumes 
		combinationRule = 34
		sourcePixSize = 32
		destPixSize = 8
		sourceForm ~= destForm.
	Note: This is not real blending since we don't have the source colors available.
	 */

function alphaSourceBlendBits8() {
	var srcShift;
	var sourceWord;
	var srcIndex;
	var deltaX;
	var mappingTable;
	var dstIndex;
	var adjust;
	var mapperFlags;
	var srcAlpha;
	var dstMask;
	var deltaY;
	var srcY;
	var destWord;
	var dstY;

	mappingTable = default8To32Table();
	mapperFlags = cmFlags & ~ColorMapNewStyle;

	/* So we can pre-decrement */

	deltaY = bbH + 1;
	srcY = sy;
	dstY = dy;
	mask1 = (dx & 3) * 8;
	if (destMSB) {
		mask1 = 24 - mask1;
	}
	mask2 = AllOnes ^ (SHL(255, mask1));
	if ((dx & 1) === 0) {
		adjust = 0;
	} else {
		adjust = 522133279;
	}
	if ((dy & 1) === 0) {
		adjust = adjust ^ 522133279;
	}
	while (((--deltaY)) !== 0) {
		adjust = adjust ^ 522133279;
		srcIndex = ((srcY * sourcePitch)) + (sx * 4);
		dstIndex = ((dstY * destPitch)) + ((dx >> 2) * 4);

		/* So we can pre-decrement */

		deltaX = bbW + 1;
		srcShift = mask1;

		/* This is the inner loop */

		dstMask = mask2;
		while (((--deltaX)) !== 0) {
			sourceWord = (sourceBits[srcIndex >>> 2] & ~adjust) + adjust;
			srcAlpha = sourceWord >>> 24;
			if (srcAlpha > 31) {

				/* Everything below 31 is transparent */

				if (srcAlpha < 224) {

					/* Everything above 224 is opaque */

					destWord = destBits[dstIndex >>> 2];
					destWord = destWord & ~dstMask;
					destWord = SHR(destWord, srcShift);
					destWord = mappingTable[destWord];
					sourceWord = alphaBlendScaledwith(sourceWord, destWord);
				}
				sourceWord = mapPixelflags(sourceWord, mapperFlags);

				/* Store back */

				sourceWord = SHL(sourceWord, srcShift);
				dstLongAtputmask(dstIndex, sourceWord, dstMask);
			}
			srcIndex += 4;
			if (destMSB) {
				if (srcShift === 0) {
					dstIndex += 4;
					srcShift = 24;
					dstMask = 16777215;
				} else {
					srcShift -= 8;
					dstMask = (dstMask >>> 8) | 4278190080;
				}
			} else {
				if (srcShift === 24) {
					dstIndex += 4;
					srcShift = 0;
					dstMask = 4294967040;
				} else {
					srcShift += 8;
					dstMask = (dstMask << 8) | 255;
				}
			}
			adjust = adjust ^ 522133279;
		}
		++srcY;
		++dstY;
	}
}

function bitAndwith(sourceWord, destinationWord) {
	return sourceWord & destinationWord;
}

function bitAndInvertwith(sourceWord, destinationWord) {
	return sourceWord & ~destinationWord;
}

function bitInvertAndwith(sourceWord, destinationWord) {
	return ~sourceWord & destinationWord;
}

function bitInvertAndInvertwith(sourceWord, destinationWord) {
	return ~sourceWord & ~destinationWord;
}

function bitInvertDestinationwith(sourceWord, destinationWord) {
	return ~destinationWord;
}

function bitInvertOrwith(sourceWord, destinationWord) {
	return ~sourceWord | destinationWord;
}

function bitInvertOrInvertwith(sourceWord, destinationWord) {
	return ~sourceWord | ~destinationWord;
}

function bitInvertSourcewith(sourceWord, destinationWord) {
	return ~sourceWord;
}

function bitInvertXorwith(sourceWord, destinationWord) {
	return ~sourceWord ^ destinationWord;
}

function bitOrwith(sourceWord, destinationWord) {
	return sourceWord | destinationWord;
}

function bitOrInvertwith(sourceWord, destinationWord) {
	return sourceWord | ~destinationWord;
}

function bitXorwith(sourceWord, destinationWord) {
	return sourceWord ^ destinationWord;
}


/*	check for possible overlap of source and destination */
/*	ar 10/19/1999: This method requires surfaces to be locked. */

function checkSourceOverlap() {
	var t;

	if ((sourceForm === destForm) && (dy >= sy)) {
		if (dy > sy) {

			/* have to start at bottom */

			vDir = -1;
			sy = (sy + bbH) - 1;
			dy = (dy + bbH) - 1;
		} else {
			if ((dy === sy) && (dx > sx)) {

				/* y's are equal, but x's are backward */

				hDir = -1;

				/* start at right */

				sx = (sx + bbW) - 1;

				/* and fix up masks */

				dx = (dx + bbW) - 1;
				if (nWords > 1) {
					t = mask1;
					mask1 = mask2;
					mask2 = t;
				}
			}
		}
		destIndex = ((dy * destPitch)) + ((DIV(dx, destPPW)) * 4);
		destDelta = (destPitch * vDir) - (4 * (nWords * hDir));
	}
}

function clearWordwith(source, destination) {
	return 0;
}


/*	clip and adjust source origin and extent appropriately */
/*	first in x */

function clipRange() {
	if (destX >= clipX) {
		sx = sourceX;
		dx = destX;
		bbW = width;
	} else {
		sx = sourceX + (clipX - destX);
		bbW = width - (clipX - destX);
		dx = clipX;
	}
	if ((dx + bbW) > (clipX + clipWidth)) {
		bbW -= (dx + bbW) - (clipX + clipWidth);
	}
	if (destY >= clipY) {
		sy = sourceY;
		dy = destY;
		bbH = height;
	} else {
		sy = (sourceY + clipY) - destY;
		bbH = height - (clipY - destY);
		dy = clipY;
	}
	if ((dy + bbH) > (clipY + clipHeight)) {
		bbH -= (dy + bbH) - (clipY + clipHeight);
	}
	if (noSource) {
		return null;
	}
	if (sx < 0) {
		dx -= sx;
		bbW += sx;
		sx = 0;
	}
	if ((sx + bbW) > sourceWidth) {
		bbW -= (sx + bbW) - sourceWidth;
	}
	if (sy < 0) {
		dy -= sy;
		bbH += sy;
		sy = 0;
	}
	if ((sy + bbH) > sourceHeight) {
		bbH -= (sy + bbH) - sourceHeight;
	}
}


/*	This function is exported for the Balloon engine */

function copyBits() {
	clipRange();
	if ((bbW <= 0) || (bbH <= 0)) {

		/* zero width or height; noop */

		affectedL = (affectedR = (affectedT = (affectedB = 0)));
		return null;
	}
	if (!lockSurfaces()) {
		return interpreterProxy.primitiveFail();
	}
	// skipping ifdef ENABLE_FAST_BLT
	copyBitsLockedAndClipped();

	unlockSurfaces();
}


/*	Recover from the fast path specialised code saying Help-I-cant-cope */

function copyBitsFallback(op, flags) {
	var done;

	// skipping ifdef ENABLE_FAST_BLT
}


/*	Perform the actual copyBits operation using the fast path specialised code; fail some cases by falling back to normal code.
	Assume: Surfaces have been locked and clipping was performed. */

function copyBitsFastPathSpecialised() {
	// skipping ifdef ENABLE_FAST_BLT
}


/*	Support for the balloon engine. */

function copyBitsFromtoat(startX, stopX, yValue) {
	destX = startX;
	destY = yValue;
	sourceX = startX;
	width = stopX - startX;
	copyBits();
	showDisplayBits();
}


/*	Perform the actual copyBits operation.
	Assume: Surfaces have been locked and clipping was performed. */

function copyBitsLockedAndClipped() {
	var done;

	copyBitsRule41Test();
	if (interpreterProxy.failed()) {
		return interpreterProxy.primitiveFail();
	}
	done = tryCopyingBitsQuickly();
	if (done) {
		return null;
	}
	if ((combinationRule === 30) || (combinationRule === 31)) {

		/* Check and fetch source alpha parameter for alpha blend */

		if (interpreterProxy.methodArgumentCount() === 1) {
			sourceAlpha = interpreterProxy.stackIntegerValue(0);
			if (!(!interpreterProxy.failed() && ((sourceAlpha >= 0) && (sourceAlpha <= 255)))) {
				return interpreterProxy.primitiveFail();
			}
		} else {
			return interpreterProxy.primitiveFail();
		}
	}

	/* Choose and perform the actual copy loop. */

	bitCount = 0;
	performCopyLoop();
	if ((combinationRule === 22) || (combinationRule === 32)) {

		/* zero width and height; return the count */

		affectedL = (affectedR = (affectedT = (affectedB = 0)));
	}
	if (hDir > 0) {
		affectedL = dx;
		affectedR = dx + bbW;
	} else {
		affectedL = (dx - bbW) + 1;
		affectedR = dx + 1;
	}
	if (vDir > 0) {
		affectedT = dy;
		affectedB = dy + bbH;
	} else {
		affectedT = (dy - bbH) + 1;
		affectedB = dy + 1;
	}
}


/*	Test possible use of rule 41, rgbComponentAlpha:with: Nothing to return, just set up some variables */

function copyBitsRule41Test() {
	var ungammaLookupTableOop;
	var gammaLookupTableOop;

	if (combinationRule === 41) {

		/* fetch the forecolor into componentAlphaModeColor. */

		componentAlphaModeAlpha = 255;
		componentAlphaModeColor = 16777215;
		gammaLookupTable = null;
		ungammaLookupTable = null;
		if (interpreterProxy.methodArgumentCount() >= 2) {
			componentAlphaModeAlpha = interpreterProxy.stackIntegerValue(interpreterProxy.methodArgumentCount() - 2);
			if (interpreterProxy.failed()) {
				return interpreterProxy.primitiveFail();
			}
			componentAlphaModeColor = interpreterProxy.stackIntegerValue(interpreterProxy.methodArgumentCount() - 1);
			if (interpreterProxy.failed()) {
				return interpreterProxy.primitiveFail();
			}
			if (interpreterProxy.methodArgumentCount() === 4) {
				gammaLookupTableOop = interpreterProxy.stackObjectValue(1);
				if (interpreterProxy.isBytes(gammaLookupTableOop)) {
					gammaLookupTable = gammaLookupTableOop.bytes;
				}
				ungammaLookupTableOop = interpreterProxy.stackObjectValue(0);
				if (interpreterProxy.isBytes(ungammaLookupTableOop)) {
					ungammaLookupTable = ungammaLookupTableOop.bytes;
				}
			}
		} else {
			if (interpreterProxy.methodArgumentCount() === 1) {
				componentAlphaModeColor = interpreterProxy.stackIntegerValue(0);
				if (interpreterProxy.failed()) {
					return interpreterProxy.primitiveFail();
				}
			} else {
				return interpreterProxy.primitiveFail();
			}
		}
	}
}


/*	This version of the inner loop assumes noSource = false. */

function copyLoop() {
	var mergeWord;
	var skewWord;
	var skewMask;
	var halftoneWord;
	var unskew;
	var mergeFnwith;
	var hInc;
	var destWord;
	var word;
	var prevWord;
	var y;
	var i;
	var thisWord;
	var notSkewMask;

	mergeFnwith = opTable[combinationRule + 1];
	mergeFnwith;

	/* Byte delta */
	/* degenerate skew fixed for Sparc. 10/20/96 ikp */

	hInc = hDir * 4;
	if (skew === -32) {
		skew = (unskew = (skewMask = 0));
	} else {
		if (skew < 0) {
			unskew = skew + 32;
			skewMask = SHL(AllOnes, (0 - skew));
		} else {
			if (skew === 0) {
				unskew = 0;
				skewMask = AllOnes;
			} else {
				unskew = skew - 32;
				skewMask = SHR(AllOnes, skew);
			}
		}
	}
	notSkewMask = ~skewMask;
	if (noHalftone) {
		halftoneWord = AllOnes;
		halftoneHeight = 0;
	} else {
		halftoneWord = halftoneAt(0);
	}
	y = dy;
	for (i = 1; i <= bbH; i++) {

		/* here is the vertical loop */

		if (halftoneHeight > 1) {

			/* Otherwise, its always the same */

			halftoneWord = halftoneAt(y);
			y += vDir;
		}
		if (preload) {

			/* load the 64-bit shifter */

			prevWord = sourceBits[sourceIndex >>> 2];
			sourceIndex += hInc;
		} else {
			prevWord = 0;
		}
		destMask = mask1;

		/* pick up next word */

		thisWord = sourceBits[sourceIndex >>> 2];
		sourceIndex += hInc;

		/* 32-bit rotate */

		skewWord = (SHIFT((prevWord & notSkewMask), unskew)) | (SHIFT((thisWord & skewMask), skew));
		prevWord = thisWord;
		destWord = destBits[destIndex >>> 2];
		mergeWord = mergeFnwith(skewWord & halftoneWord, destWord);
		destWord = (destMask & mergeWord) | (destWord & ~destMask);
		destBits[destIndex >>> 2] = destWord;

		/* This central horizontal loop requires no store masking */

		destIndex += hInc;
		destMask = AllOnes;
		if (combinationRule === 3) {
			if ((skew === 0) && (halftoneWord === AllOnes)) {

				/* Very special inner loop for STORE mode with no skew -- just move words */

				if (hDir === -1) {

					/* Woeful patch: revert to older code for hDir = -1 */

					for (word = 2; word <= (nWords - 1); word++) {
						thisWord = sourceBits[sourceIndex >>> 2];
						sourceIndex += hInc;
						destBits[destIndex >>> 2] = thisWord;
						destIndex += hInc;
					}
				} else {
					for (word = 2; word <= (nWords - 1); word++) {

						/* Note loop starts with prevWord loaded (due to preload) */

						destBits[destIndex >>> 2] = prevWord;
						destIndex += hInc;
						prevWord = sourceBits[sourceIndex >>> 2];
						sourceIndex += hInc;
					}
				}
			} else {

				/* Special inner loop for STORE mode -- no need to call merge */

				for (word = 2; word <= (nWords - 1); word++) {
					thisWord = sourceBits[sourceIndex >>> 2];
					sourceIndex += hInc;

					/* 32-bit rotate */

					skewWord = (SHIFT((prevWord & notSkewMask), unskew)) | (SHIFT((thisWord & skewMask), skew));
					prevWord = thisWord;
					destBits[destIndex >>> 2] = skewWord & halftoneWord;
					destIndex += hInc;
				}
			}
		} else {
			for (word = 2; word <= (nWords - 1); word++) {

				/* Normal inner loop does merge: */


				/* pick up next word */

				thisWord = sourceBits[sourceIndex >>> 2];
				sourceIndex += hInc;

				/* 32-bit rotate */

				skewWord = (SHIFT((prevWord & notSkewMask), unskew)) | (SHIFT((thisWord & skewMask), skew));
				prevWord = thisWord;
				mergeWord = mergeFnwith(skewWord & halftoneWord, destBits[destIndex >>> 2]);
				destBits[destIndex >>> 2] = mergeWord;
				destIndex += hInc;
			}
		}
		if (nWords > 1) {
			destMask = mask2;

			/* pick up next word */

			thisWord = sourceBits[sourceIndex >>> 2];
			sourceIndex += hInc;

			/* 32-bit rotate */

			skewWord = (SHIFT((prevWord & notSkewMask), unskew)) | (SHIFT((thisWord & skewMask), skew));
			destWord = destBits[destIndex >>> 2];
			mergeWord = mergeFnwith(skewWord & halftoneWord, destWord);
			destWord = (destMask & mergeWord) | (destWord & ~destMask);
			destBits[destIndex >>> 2] = destWord;
			destIndex += hInc;
		}
		sourceIndex += sourceDelta;
		destIndex += destDelta;
	}
}


/*	Faster copyLoop when source not used.  hDir and vDir are both
	positive, and perload and skew are unused */

function copyLoopNoSource() {
	var mergeWord;
	var halftoneWord;
	var mergeFnwith;
	var destWord;
	var word;
	var i;

	mergeFnwith = opTable[combinationRule + 1];
	mergeFnwith;
	for (i = 1; i <= bbH; i++) {

		/* here is the vertical loop */

		if (noHalftone) {
			halftoneWord = AllOnes;
		} else {
			halftoneWord = halftoneAt((dy + i) - 1);
		}
		destMask = mask1;
		destWord = destBits[destIndex >>> 2];
		mergeWord = mergeFnwith(halftoneWord, destWord);
		destWord = (destMask & mergeWord) | (destWord & ~destMask);
		destBits[destIndex >>> 2] = destWord;

		/* This central horizontal loop requires no store masking */

		destIndex += 4;
		destMask = AllOnes;
		if (combinationRule === 3) {

			/* Special inner loop for STORE */

			destWord = halftoneWord;
			for (word = 2; word <= (nWords - 1); word++) {
				destBits[destIndex >>> 2] = destWord;
				destIndex += 4;
			}
		} else {

			/* Normal inner loop does merge */

			for (word = 2; word <= (nWords - 1); word++) {

				/* Normal inner loop does merge */

				destWord = destBits[destIndex >>> 2];
				mergeWord = mergeFnwith(halftoneWord, destWord);
				destBits[destIndex >>> 2] = mergeWord;
				destIndex += 4;
			}
		}
		if (nWords > 1) {
			destMask = mask2;
			destWord = destBits[destIndex >>> 2];
			mergeWord = mergeFnwith(halftoneWord, destWord);
			destWord = (destMask & mergeWord) | (destWord & ~destMask);
			destBits[destIndex >>> 2] = destWord;
			destIndex += 4;
		}
		destIndex += destDelta;
	}
}


/*	This version of the inner loop maps source pixels
	to a destination form with different depth.  Because it is already
	unweildy, the loop is not unrolled as in the other versions.
	Preload, skew and skewMask are all overlooked, since pickSourcePixels
	delivers its destination word already properly aligned.
	Note that pickSourcePixels could be copied in-line at the top of
	the horizontal loop, and some of its inits moved out of the loop. */
/*	ar 12/7/1999:
	The loop has been rewritten to use only one pickSourcePixels call.
	The idea is that the call itself could be inlined. If we decide not
	to inline pickSourcePixels we could optimize the loop instead. */

function copyLoopPixMap() {
	var mapperFlags;
	var srcShiftInc;
	var dstShiftLeft;
	var sourcePixMask;
	var nSourceIncs;
	var skewWord;
	var words;
	var destWord;
	var startBits;
	var mergeFnwith;
	var dstShift;
	var i;
	var halftoneWord;
	var mergeWord;
	var destPixMask;
	var dstShiftInc;
	var srcShift;
	var endBits;
	var nPix;
	var scrStartBits;

	mergeFnwith = opTable[combinationRule + 1];
	mergeFnwith;
	sourcePPW = DIV(32, sourceDepth);
	sourcePixMask = maskTable[sourceDepth];
	destPixMask = maskTable[destDepth];
	mapperFlags = cmFlags & ~ColorMapNewStyle;
	sourceIndex = ((sy * sourcePitch)) + ((DIV(sx, sourcePPW)) * 4);
	scrStartBits = sourcePPW - (sx & (sourcePPW - 1));
	if (bbW < scrStartBits) {
		nSourceIncs = 0;
	} else {
		nSourceIncs = (DIV((bbW - scrStartBits), sourcePPW)) + 1;
	}

	/* Note following two items were already calculated in destmask setup! */

	sourceDelta = sourcePitch - (nSourceIncs * 4);
	startBits = destPPW - (dx & (destPPW - 1));
	endBits = (((dx + bbW) - 1) & (destPPW - 1)) + 1;
	if (bbW < startBits) {
		startBits = bbW;
	}
	srcShift = (sx & (sourcePPW - 1)) * sourceDepth;
	dstShift = (dx & (destPPW - 1)) * destDepth;
	srcShiftInc = sourceDepth;
	dstShiftInc = destDepth;
	dstShiftLeft = 0;
	if (sourceMSB) {
		srcShift = (32 - sourceDepth) - srcShift;
		srcShiftInc = 0 - srcShiftInc;
	}
	if (destMSB) {
		dstShift = (32 - destDepth) - dstShift;
		dstShiftInc = 0 - dstShiftInc;
		dstShiftLeft = 32 - destDepth;
	}
	for (i = 1; i <= bbH; i++) {

		/* here is the vertical loop */
		/* *** is it possible at all that noHalftone == false? *** */

		if (noHalftone) {
			halftoneWord = AllOnes;
		} else {
			halftoneWord = halftoneAt((dy + i) - 1);
		}
		srcBitShift = srcShift;
		dstBitShift = dstShift;
		destMask = mask1;

		/* Here is the horizontal loop... */

		nPix = startBits;
		words = nWords;
		do {

			/* pick up the word */


			/* align next word to leftmost pixel */

			skewWord = pickSourcePixelsflagssrcMaskdestMasksrcShiftIncdstShiftInc(nPix, mapperFlags, sourcePixMask, destPixMask, srcShiftInc, dstShiftInc);
			dstBitShift = dstShiftLeft;
			if (destMask === AllOnes) {

				/* avoid read-modify-write */

				mergeWord = mergeFnwith(skewWord & halftoneWord, destBits[destIndex >>> 2]);
				destBits[destIndex >>> 2] = destMask & mergeWord;
			} else {

				/* General version using dest masking */

				destWord = destBits[destIndex >>> 2];
				mergeWord = mergeFnwith(skewWord & halftoneWord, destWord & destMask);
				destWord = (destMask & mergeWord) | (destWord & ~destMask);
				destBits[destIndex >>> 2] = destWord;
			}
			destIndex += 4;
			if (words === 2) {

				/* e.g., is the next word the last word? */
				/* set mask for last word in this row */

				destMask = mask2;
				nPix = endBits;
			} else {

				/* use fullword mask for inner loop */

				destMask = AllOnes;
				nPix = destPPW;
			}
		} while(!(((--words)) === 0));
		sourceIndex += sourceDelta;
		destIndex += destDelta;
	}
}


/*	Return the default translation table from 1..8 bit indexed colors to 32bit */
/*	The table has been generated by the following statements */
/*	| pvs hex |
	String streamContents:[:s|
		s nextPutAll:'static unsigned int theTable[256] = { '.
		pvs := (Color colorMapIfNeededFrom: 8 to: 32) asArray.
		1 to: pvs size do:[:i|
			i > 1 ifTrue:[s nextPutAll:', '].
			(i-1 \\ 8) = 0 ifTrue:[s cr].
			s nextPutAll:'0x'.
			hex := (pvs at: i) printStringBase: 16.
			s nextPutAll: (hex copyFrom: 4 to: hex size).
		].
		s nextPutAll:'};'.
	]. */

function default8To32Table() {
	var theTable = [ 
0x0, 0xFF000001, 0xFFFFFFFF, 0xFF808080, 0xFFFF0000, 0xFF00FF00, 0xFF0000FF, 0xFF00FFFF, 
0xFFFFFF00, 0xFFFF00FF, 0xFF202020, 0xFF404040, 0xFF606060, 0xFF9F9F9F, 0xFFBFBFBF, 0xFFDFDFDF, 
0xFF080808, 0xFF101010, 0xFF181818, 0xFF282828, 0xFF303030, 0xFF383838, 0xFF484848, 0xFF505050, 
0xFF585858, 0xFF686868, 0xFF707070, 0xFF787878, 0xFF878787, 0xFF8F8F8F, 0xFF979797, 0xFFA7A7A7, 
0xFFAFAFAF, 0xFFB7B7B7, 0xFFC7C7C7, 0xFFCFCFCF, 0xFFD7D7D7, 0xFFE7E7E7, 0xFFEFEFEF, 0xFFF7F7F7, 
0xFF000001, 0xFF003300, 0xFF006600, 0xFF009900, 0xFF00CC00, 0xFF00FF00, 0xFF000033, 0xFF003333, 
0xFF006633, 0xFF009933, 0xFF00CC33, 0xFF00FF33, 0xFF000066, 0xFF003366, 0xFF006666, 0xFF009966, 
0xFF00CC66, 0xFF00FF66, 0xFF000099, 0xFF003399, 0xFF006699, 0xFF009999, 0xFF00CC99, 0xFF00FF99, 
0xFF0000CC, 0xFF0033CC, 0xFF0066CC, 0xFF0099CC, 0xFF00CCCC, 0xFF00FFCC, 0xFF0000FF, 0xFF0033FF, 
0xFF0066FF, 0xFF0099FF, 0xFF00CCFF, 0xFF00FFFF, 0xFF330000, 0xFF333300, 0xFF336600, 0xFF339900, 
0xFF33CC00, 0xFF33FF00, 0xFF330033, 0xFF333333, 0xFF336633, 0xFF339933, 0xFF33CC33, 0xFF33FF33, 
0xFF330066, 0xFF333366, 0xFF336666, 0xFF339966, 0xFF33CC66, 0xFF33FF66, 0xFF330099, 0xFF333399, 
0xFF336699, 0xFF339999, 0xFF33CC99, 0xFF33FF99, 0xFF3300CC, 0xFF3333CC, 0xFF3366CC, 0xFF3399CC, 
0xFF33CCCC, 0xFF33FFCC, 0xFF3300FF, 0xFF3333FF, 0xFF3366FF, 0xFF3399FF, 0xFF33CCFF, 0xFF33FFFF, 
0xFF660000, 0xFF663300, 0xFF666600, 0xFF669900, 0xFF66CC00, 0xFF66FF00, 0xFF660033, 0xFF663333, 
0xFF666633, 0xFF669933, 0xFF66CC33, 0xFF66FF33, 0xFF660066, 0xFF663366, 0xFF666666, 0xFF669966, 
0xFF66CC66, 0xFF66FF66, 0xFF660099, 0xFF663399, 0xFF666699, 0xFF669999, 0xFF66CC99, 0xFF66FF99, 
0xFF6600CC, 0xFF6633CC, 0xFF6666CC, 0xFF6699CC, 0xFF66CCCC, 0xFF66FFCC, 0xFF6600FF, 0xFF6633FF, 
0xFF6666FF, 0xFF6699FF, 0xFF66CCFF, 0xFF66FFFF, 0xFF990000, 0xFF993300, 0xFF996600, 0xFF999900, 
0xFF99CC00, 0xFF99FF00, 0xFF990033, 0xFF993333, 0xFF996633, 0xFF999933, 0xFF99CC33, 0xFF99FF33, 
0xFF990066, 0xFF993366, 0xFF996666, 0xFF999966, 0xFF99CC66, 0xFF99FF66, 0xFF990099, 0xFF993399, 
0xFF996699, 0xFF999999, 0xFF99CC99, 0xFF99FF99, 0xFF9900CC, 0xFF9933CC, 0xFF9966CC, 0xFF9999CC, 
0xFF99CCCC, 0xFF99FFCC, 0xFF9900FF, 0xFF9933FF, 0xFF9966FF, 0xFF9999FF, 0xFF99CCFF, 0xFF99FFFF, 
0xFFCC0000, 0xFFCC3300, 0xFFCC6600, 0xFFCC9900, 0xFFCCCC00, 0xFFCCFF00, 0xFFCC0033, 0xFFCC3333, 
0xFFCC6633, 0xFFCC9933, 0xFFCCCC33, 0xFFCCFF33, 0xFFCC0066, 0xFFCC3366, 0xFFCC6666, 0xFFCC9966, 
0xFFCCCC66, 0xFFCCFF66, 0xFFCC0099, 0xFFCC3399, 0xFFCC6699, 0xFFCC9999, 0xFFCCCC99, 0xFFCCFF99, 
0xFFCC00CC, 0xFFCC33CC, 0xFFCC66CC, 0xFFCC99CC, 0xFFCCCCCC, 0xFFCCFFCC, 0xFFCC00FF, 0xFFCC33FF, 
0xFFCC66FF, 0xFFCC99FF, 0xFFCCCCFF, 0xFFCCFFFF, 0xFFFF0000, 0xFFFF3300, 0xFFFF6600, 0xFFFF9900, 
0xFFFFCC00, 0xFFFFFF00, 0xFFFF0033, 0xFFFF3333, 0xFFFF6633, 0xFFFF9933, 0xFFFFCC33, 0xFFFFFF33, 
0xFFFF0066, 0xFFFF3366, 0xFFFF6666, 0xFFFF9966, 0xFFFFCC66, 0xFFFFFF66, 0xFFFF0099, 0xFFFF3399, 
0xFFFF6699, 0xFFFF9999, 0xFFFFCC99, 0xFFFFFF99, 0xFFFF00CC, 0xFFFF33CC, 0xFFFF66CC, 0xFFFF99CC, 
0xFFFFCCCC, 0xFFFFFFCC, 0xFFFF00FF, 0xFFFF33FF, 0xFFFF66FF, 0xFFFF99FF, 0xFFFFCCFF, 0xFFFFFFFF];;

	return theTable;
}


/*	Utility routine for computing Warp increments. */

function deltaFromtonSteps(x1, x2, n) {
	if (x2 > x1) {
		return (DIV(((x2 - x1) + FixedPt1), (n + 1))) + 1;
	} else {
		if (x2 === x1) {
			return 0;
		}
		return 0 - ((DIV(((x1 - x2) + FixedPt1), (n + 1))) + 1);
	}
}


/*	Compute masks for left and right destination words */

function destMaskAndPointerInit() {
	var endBits;
	var startBits;
	var pixPerM1;


	/* A mask, assuming power of two */
	/* how many pixels in first word */

	pixPerM1 = destPPW - 1;
	startBits = destPPW - (dx & pixPerM1);
	if (destMSB) {
		mask1 = SHR(AllOnes, (32 - (startBits * destDepth)));
	} else {
		mask1 = SHL(AllOnes, (32 - (startBits * destDepth)));
	}
	endBits = (((dx + bbW) - 1) & pixPerM1) + 1;
	if (destMSB) {
		mask2 = SHL(AllOnes, (32 - (endBits * destDepth)));
	} else {
		mask2 = SHR(AllOnes, (32 - (endBits * destDepth)));
	}
	if (bbW < startBits) {
		mask1 = mask1 & mask2;
		mask2 = 0;
		nWords = 1;
	} else {
		nWords = (DIV(((bbW - startBits) + pixPerM1), destPPW)) + 1;
	}

	/* defaults for no overlap with source */
	/* calculate byte addr and delta, based on first word of data */
	/* Note pitch is bytes and nWords is longs, not bytes */

	hDir = (vDir = 1);
	destIndex = ((dy * destPitch)) + ((DIV(dx, destPPW)) * 4);
	destDelta = (destPitch * vDir) - (4 * (nWords * hDir));
}

function destinationWordwith(sourceWord, destinationWord) {
	return destinationWord;
}


/*	Dither the given 32bit word to 16 bit. Ignore alpha. */

function dither32To16threshold(srcWord, ditherValue) {
	var addThreshold;


	/* You bet */

	addThreshold = ditherValue << 8;
	return ((dither8Lookup[addThreshold + ((srcWord >>> 16) & 255)] << 10) + (dither8Lookup[addThreshold + ((srcWord >>> 8) & 255)] << 5)) + dither8Lookup[addThreshold + (srcWord & 255)];
}


/*	This is the primitive implementation of the line-drawing loop.
	See the comments in BitBlt>>drawLoopX:Y: */

function drawLoopXY(xDelta, yDelta) {
	var P;
	var affT;
	var dx1;
	var px;
	var affR;
	var affL;
	var py;
	var i;
	var affB;
	var dy1;

	if (xDelta > 0) {
		dx1 = 1;
	} else {
		if (xDelta === 0) {
			dx1 = 0;
		} else {
			dx1 = -1;
		}
	}
	if (yDelta > 0) {
		dy1 = 1;
	} else {
		if (yDelta === 0) {
			dy1 = 0;
		} else {
			dy1 = -1;
		}
	}
	px = Math.abs(yDelta);
	py = Math.abs(xDelta);

	/* init null rectangle */

	affL = (affT = 9999);
	affR = (affB = -9999);
	if (py > px) {

		/* more horizontal */

		P = py >> 1;
		for (i = 1; i <= py; i++) {
			destX += dx1;
			if (((P -= px)) < 0) {
				destY += dy1;
				P += py;
			}
			if (i < py) {
				copyBits();
				if (interpreterProxy.failed()) {
					return null;
				}
				if ((affectedL < affectedR) && (affectedT < affectedB)) {

					/* Affected rectangle grows along the line */

					affL = Math.min(affL, affectedL);
					affR = Math.max(affR, affectedR);
					affT = Math.min(affT, affectedT);
					affB = Math.max(affB, affectedB);
					if (((affR - affL) * (affB - affT)) > 4000) {

						/* If affected rectangle gets large, update it in chunks */

						affectedL = affL;
						affectedR = affR;
						affectedT = affT;
						affectedB = affB;
						showDisplayBits();

						/* init null rectangle */

						affL = (affT = 9999);
						affR = (affB = -9999);
					}
				}
			}
		}
	} else {

		/* more vertical */

		P = px >> 1;
		for (i = 1; i <= px; i++) {
			destY += dy1;
			if (((P -= py)) < 0) {
				destX += dx1;
				P += px;
			}
			if (i < px) {
				copyBits();
				if (interpreterProxy.failed()) {
					return null;
				}
				if ((affectedL < affectedR) && (affectedT < affectedB)) {

					/* Affected rectangle grows along the line */

					affL = Math.min(affL, affectedL);
					affR = Math.max(affR, affectedR);
					affT = Math.min(affT, affectedT);
					affB = Math.max(affB, affectedB);
					if (((affR - affL) * (affB - affT)) > 4000) {

						/* If affected rectangle gets large, update it in chunks */

						affectedL = affL;
						affectedR = affR;
						affectedT = affT;
						affectedB = affB;
						showDisplayBits();

						/* init null rectangle */

						affL = (affT = 9999);
						affR = (affB = -9999);
					}
				}
			}
		}
	}
	affectedL = affL;
	affectedR = affR;
	affectedT = affT;

	/* store destX, Y back */

	affectedB = affB;
	interpreterProxy.storeIntegerofObjectwithValue(BBDestXIndex, bitBltOop, destX);
	interpreterProxy.storeIntegerofObjectwithValue(BBDestYIndex, bitBltOop, destY);
}


/*	Store the given value back into destination form, using dstMask
	to mask out the bits to be modified. This is an essiantial
	read-modify-write operation on the destination form. */

function dstLongAtputmask(idx, srcValue, dstMask) {
	var dstValue;

	dstValue = destBits[idx >>> 2];
	dstValue = dstValue & dstMask;
	dstValue = dstValue | srcValue;
	destBits[idx >>> 2] = dstValue;
}


/*	Dither the given 32bit word to 16 bit. Ignore alpha. */

function expensiveDither32To16threshold(srcWord, ditherValue) {
	var pv;
	var threshold;
	var value;
	var out;


	/* You bet */

	pv = srcWord & 255;
	threshold = ditherThresholds16[pv & 7];
	value = ditherValues16[pv >>> 3];
	if (ditherValue < threshold) {
		out = value + 1;
	} else {
		out = value;
	}
	pv = (srcWord >>> 8) & 255;
	threshold = ditherThresholds16[pv & 7];
	value = ditherValues16[pv >>> 3];
	if (ditherValue < threshold) {
		out = out | ((value + 1) << 5);
	} else {
		out = out | (value << 5);
	}
	pv = (srcWord >>> 16) & 255;
	threshold = ditherThresholds16[pv & 7];
	value = ditherValues16[pv >>> 3];
	if (ditherValue < threshold) {
		out = out | ((value + 1) << 10);
	} else {
		out = out | (value << 10);
	}
	return out;
}


/*	Return the integer value of the given field of the given object. If the field contains a Float, truncate it and return its integral part. Fail if the given field does not contain a small integer or Float, or if the truncated Float is out of the range of small integers. */

function fetchIntOrFloatofObject(fieldIndex, objectPointer) {
	var floatValue;
	var fieldOop;

	fieldOop = interpreterProxy.fetchPointerofObject(fieldIndex, objectPointer);
	if (typeof fieldOop === "number") {
		return fieldOop;
	}
	floatValue = interpreterProxy.floatValueOf(fieldOop);
	if (!((-2.147483648e9 <= floatValue) && (floatValue <= 2.147483647e9))) {
		interpreterProxy.primitiveFail();
		return 0;
	}
	return (floatValue|0);
}


/*	Return the integer value of the given field of the given object. If the field contains a Float, truncate it and return its integral part. Fail if the given field does not contain a small integer or Float, or if the truncated Float is out of the range of small integers. */

function fetchIntOrFloatofObjectifNil(fieldIndex, objectPointer, defaultValue) {
	var floatValue;
	var fieldOop;

	fieldOop = interpreterProxy.fetchPointerofObject(fieldIndex, objectPointer);
	if (typeof fieldOop === "number") {
		return fieldOop;
	}
	if (fieldOop.isNil) {
		return defaultValue;
	}
	floatValue = interpreterProxy.floatValueOf(fieldOop);
	if (!((-2.147483648e9 <= floatValue) && (floatValue <= 2.147483647e9))) {
		interpreterProxy.primitiveFail();
		return 0;
	}
	return (floatValue|0);
}


/*	For any non-zero pixel value in destinationWord with zero alpha channel take the alpha from sourceWord and fill it in. Intended for fixing alpha channels left at zero during 16->32 bpp conversions. */

function fixAlphawith(sourceWord, destinationWord) {
	if (destDepth !== 32) {
		return destinationWord;
	}
	if (destinationWord === 0) {
		return 0;
	}
	if ((destinationWord & 4278190080) !== 0) {
		return destinationWord;
	}
	return destinationWord | (sourceWord & 4278190080);
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}


/*	Return a value from the halftone pattern. */

function halftoneAt(idx) {
	return halftoneBase[MOD(idx, halftoneHeight)];
}

function halt() {
	;
}

function ignoreSourceOrHalftone(formPointer) {
	if (formPointer.isNil) {
		return true;
	}
	if (combinationRule === 0) {
		return true;
	}
	if (combinationRule === 5) {
		return true;
	}
	if (combinationRule === 10) {
		return true;
	}
	if (combinationRule === 15) {
		return true;
	}
	return false;
}

function initBBOpTable() {
	opTable[0+1] = clearWordwith;
	opTable[1+1] = bitAndwith;
	opTable[2+1] = bitAndInvertwith;
	opTable[3+1] = sourceWordwith;
	opTable[4+1] = bitInvertAndwith;
	opTable[5+1] = destinationWordwith;
	opTable[6+1] = bitXorwith;
	opTable[7+1] = bitOrwith;
	opTable[8+1] = bitInvertAndInvertwith;
	opTable[9+1] = bitInvertXorwith;
	opTable[10+1] = bitInvertDestinationwith;
	opTable[11+1] = bitOrInvertwith;
	opTable[12+1] = bitInvertSourcewith;
	opTable[13+1] = bitInvertOrwith;
	opTable[14+1] = bitInvertOrInvertwith;
	opTable[15+1] = destinationWordwith;
	opTable[16+1] = destinationWordwith;
	opTable[17+1] = destinationWordwith;
	opTable[18+1] = addWordwith;
	opTable[19+1] = subWordwith;
	opTable[20+1] = rgbAddwith;
	opTable[21+1] = rgbSubwith;
	opTable[22+1] = OLDrgbDiffwith;
	opTable[23+1] = OLDtallyIntoMapwith;
	opTable[24+1] = alphaBlendwith;
	opTable[25+1] = pixPaintwith;
	opTable[26+1] = pixMaskwith;
	opTable[27+1] = rgbMaxwith;
	opTable[28+1] = rgbMinwith;
	opTable[29+1] = rgbMinInvertwith;
	opTable[30+1] = alphaBlendConstwith;
	opTable[31+1] = alphaPaintConstwith;
	opTable[32+1] = rgbDiffwith;
	opTable[33+1] = tallyIntoMapwith;
	opTable[34+1] = alphaBlendScaledwith;
	opTable[35+1] = alphaBlendScaledwith;
	opTable[36+1] = alphaBlendScaledwith;
	opTable[37+1] = rgbMulwith;
	opTable[38+1] = pixSwapwith;
	opTable[39+1] = pixClearwith;
	opTable[40+1] = fixAlphawith;
	opTable[41+1] = rgbComponentAlphawith;
}

function initDither8Lookup() {
	var t;
	var b;
	var value;

	for (b = 0; b <= 255; b++) {
		for (t = 0; t <= 15; t++) {
			value = expensiveDither32To16threshold(b, t);
			dither8Lookup[(t << 8) + b] = value;
		}
	}
}

function initialiseModule() {
	initBBOpTable();
	initDither8Lookup();
	// skipping ifdef ENABLE_FAST_BLT
	return true;
}


/*	Return true if shiftTable/maskTable define an identity mapping. */

function isIdentityMapwith(shifts, masks) {
	if ((!shifts) || (!masks)) {
		return true;
	}
	if ((shifts[RedIndex] === 0) && ((shifts[GreenIndex] === 0) && ((shifts[BlueIndex] === 0) && ((shifts[AlphaIndex] === 0) && ((masks[RedIndex] === 16711680) && ((masks[GreenIndex] === 65280) && ((masks[BlueIndex] === 255) && (masks[AlphaIndex] === 4278190080)))))))) {
		return true;
	}
	return false;
}


/*	Load the dest form for BitBlt. Return false if anything is wrong, true otherwise. */

function loadBitBltDestForm() {
	var destBitsSize;

	destBits = interpreterProxy.fetchPointerofObject(FormBitsIndex, destForm);
	destWidth = interpreterProxy.fetchIntegerofObject(FormWidthIndex, destForm);
	destHeight = interpreterProxy.fetchIntegerofObject(FormHeightIndex, destForm);
	if (!((destWidth >= 0) && (destHeight >= 0))) {
		return false;
	}
	destDepth = interpreterProxy.fetchIntegerofObject(FormDepthIndex, destForm);
	destMSB = destDepth > 0;
	if (destDepth < 0) {
		destDepth = 0 - destDepth;
	}
	if (typeof destBits === "number") {

		/* Query for actual surface dimensions */

		if (!queryDestSurface(destBits)) {
			return false;
		}
		destPPW = DIV(32, destDepth);
		destBits = (destPitch = 0);
	} else {
		destPPW = DIV(32, destDepth);
		destPitch = (DIV((destWidth + (destPPW - 1)), destPPW)) * 4;
		destBitsSize = BYTESIZEOF(destBits);
		if (!(interpreterProxy.isWordsOrBytes(destBits) && (destBitsSize === (destPitch * destHeight)))) {
			return false;
		}
		destBits = destBits.wordsOrBytes();
	}
	return true;
}


/*	Load BitBlt from the oop.
	This function is exported for the Balloon engine. */

function loadBitBltFrom(bbObj) {
	return loadBitBltFromwarping(bbObj, false);
}


/*	Load context from BitBlt instance.  Return false if anything is amiss */
/*	NOTE this should all be changed to minX/maxX coordinates for simpler clipping
		-- once it works! */

function loadBitBltFromwarping(bbObj, aBool) {
	var ok;

	bitBltOop = bbObj;
	isWarping = aBool;
	combinationRule = interpreterProxy.fetchIntegerofObject(BBRuleIndex, bitBltOop);
	if (interpreterProxy.failed() || ((combinationRule < 0) || (combinationRule > (OpTableSize - 2)))) {
		return false;
	}
	if ((combinationRule >= 16) && (combinationRule <= 17)) {
		return false;
	}
	sourceForm = interpreterProxy.fetchPointerofObject(BBSourceFormIndex, bitBltOop);
	noSource = ignoreSourceOrHalftone(sourceForm);
	halftoneForm = interpreterProxy.fetchPointerofObject(BBHalftoneFormIndex, bitBltOop);
	noHalftone = ignoreSourceOrHalftone(halftoneForm);
	destForm = interpreterProxy.fetchPointerofObject(BBDestFormIndex, bbObj);
	if (!(interpreterProxy.isPointers(destForm) && (SIZEOF(destForm) >= 4))) {
		return false;
	}
	ok = loadBitBltDestForm();
	if (!ok) {
		return false;
	}
	destX = fetchIntOrFloatofObjectifNil(BBDestXIndex, bitBltOop, 0);
	destY = fetchIntOrFloatofObjectifNil(BBDestYIndex, bitBltOop, 0);
	width = fetchIntOrFloatofObjectifNil(BBWidthIndex, bitBltOop, destWidth);
	height = fetchIntOrFloatofObjectifNil(BBHeightIndex, bitBltOop, destHeight);
	if (interpreterProxy.failed()) {
		return false;
	}
	if (noSource) {
		sourceX = (sourceY = 0);
	} else {
		if (!(interpreterProxy.isPointers(sourceForm) && (SIZEOF(sourceForm) >= 4))) {
			return false;
		}
		ok = loadBitBltSourceForm();
		if (!ok) {
			return false;
		}
		ok = loadColorMap();
		if (!ok) {
			return false;
		}
		if ((cmFlags & ColorMapNewStyle) === 0) {
			setupColorMasks();
		}
		sourceX = fetchIntOrFloatofObjectifNil(BBSourceXIndex, bitBltOop, 0);
		sourceY = fetchIntOrFloatofObjectifNil(BBSourceYIndex, bitBltOop, 0);
	}
	ok = loadHalftoneForm();
	if (!ok) {
		return false;
	}
	clipX = fetchIntOrFloatofObjectifNil(BBClipXIndex, bitBltOop, 0);
	clipY = fetchIntOrFloatofObjectifNil(BBClipYIndex, bitBltOop, 0);
	clipWidth = fetchIntOrFloatofObjectifNil(BBClipWidthIndex, bitBltOop, destWidth);
	clipHeight = fetchIntOrFloatofObjectifNil(BBClipHeightIndex, bitBltOop, destHeight);
	if (interpreterProxy.failed()) {
		return false;
	}
	if (clipX < 0) {
		clipWidth += clipX;
		clipX = 0;
	}
	if (clipY < 0) {
		clipHeight += clipY;
		clipY = 0;
	}
	if ((clipX + clipWidth) > destWidth) {
		clipWidth = destWidth - clipX;
	}
	if ((clipY + clipHeight) > destHeight) {
		clipHeight = destHeight - clipY;
	}
	return true;
}


/*	Load the source form for BitBlt. Return false if anything is wrong, true otherwise. */

function loadBitBltSourceForm() {
	var sourceBitsSize;

	sourceBits = interpreterProxy.fetchPointerofObject(FormBitsIndex, sourceForm);
	sourceWidth = fetchIntOrFloatofObject(FormWidthIndex, sourceForm);
	sourceHeight = fetchIntOrFloatofObject(FormHeightIndex, sourceForm);
	if (!((sourceWidth >= 0) && (sourceHeight >= 0))) {
		return false;
	}
	sourceDepth = interpreterProxy.fetchIntegerofObject(FormDepthIndex, sourceForm);
	sourceMSB = sourceDepth > 0;
	if (sourceDepth < 0) {
		sourceDepth = 0 - sourceDepth;
	}
	if (typeof sourceBits === "number") {

		/* Query for actual surface dimensions */

		if (!querySourceSurface(sourceBits)) {
			return false;
		}
		sourcePPW = DIV(32, sourceDepth);
		sourceBits = (sourcePitch = 0);
	} else {
		sourcePPW = DIV(32, sourceDepth);
		sourcePitch = (DIV((sourceWidth + (sourcePPW - 1)), sourcePPW)) * 4;
		sourceBitsSize = BYTESIZEOF(sourceBits);
		if (!(interpreterProxy.isWordsOrBytes(sourceBits) && (sourceBitsSize === (sourcePitch * sourceHeight)))) {
			return false;
		}
		sourceBits = sourceBits.wordsOrBytes();
	}
	return true;
}


/*	ColorMap, if not nil, must be longWords, and 
	2^N long, where N = sourceDepth for 1, 2, 4, 8 bits, 
	or N = 9, 12, or 15 (3, 4, 5 bits per color) for 16 or 32 bits. */

function loadColorMap() {
	var oop;
	var cmOop;
	var cmSize;
	var oldStyle;

	cmFlags = (cmMask = (cmBitsPerColor = 0));
	cmShiftTable = null;
	cmMaskTable = null;
	cmLookupTable = null;
	cmOop = interpreterProxy.fetchPointerofObject(BBColorMapIndex, bitBltOop);
	if (cmOop.isNil) {
		return true;
	}

	/* even if identity or somesuch - may be cleared later */

	cmFlags = ColorMapPresent;
	oldStyle = false;
	if (interpreterProxy.isWords(cmOop)) {

		/* This is an old-style color map (indexed only, with implicit RGBA conversion) */

		cmSize = SIZEOF(cmOop);
		cmLookupTable = cmOop.words;
		oldStyle = true;
		;
	} else {

		/* A new-style color map (fully qualified) */

		if (!(interpreterProxy.isPointers(cmOop) && (SIZEOF(cmOop) >= 3))) {
			return false;
		}
		cmShiftTable = loadColorMapShiftOrMaskFrom(interpreterProxy.fetchPointerofObject(0, cmOop));
		cmMaskTable = loadColorMapShiftOrMaskFrom(interpreterProxy.fetchPointerofObject(1, cmOop));
		oop = interpreterProxy.fetchPointerofObject(2, cmOop);
		if (oop.isNil) {
			cmSize = 0;
		} else {
			if (!interpreterProxy.isWords(oop)) {
				return false;
			}
			cmSize = SIZEOF(oop);
			cmLookupTable = oop.words;
		}
		cmFlags = cmFlags | ColorMapNewStyle;
		;
	}
	if ((cmSize & (cmSize - 1)) !== 0) {
		return false;
	}
	cmMask = cmSize - 1;
	cmBitsPerColor = 0;
	if (cmSize === 512) {
		cmBitsPerColor = 3;
	}
	if (cmSize === 4096) {
		cmBitsPerColor = 4;
	}
	if (cmSize === 32768) {
		cmBitsPerColor = 5;
	}
	if (cmSize === 0) {
		cmLookupTable = null;
		cmMask = 0;
	} else {
		cmFlags = cmFlags | ColorMapIndexedPart;
	}
	if (oldStyle) {

		/* needs implicit conversion */

		setupColorMasks();
	}
	if (isIdentityMapwith(cmShiftTable, cmMaskTable)) {
		cmMaskTable = null;
		cmShiftTable = null;
	} else {
		cmFlags = cmFlags | ColorMapFixedPart;
	}
	return true;
}

function loadColorMapShiftOrMaskFrom(mapOop) {
	if (mapOop.isNil) {
		return null;
	}
	if (typeof mapOop === "number") {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!(interpreterProxy.isWords(mapOop) && (SIZEOF(mapOop) === 4))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	return mapOop.words;
}


/*	Load the halftone form */

function loadHalftoneForm() {
	var halftoneBits;

	if (noHalftone) {
		halftoneBase = null;
		return true;
	}
	if (interpreterProxy.isPointers(halftoneForm) && (SIZEOF(halftoneForm) >= 4)) {

		/* Old-style 32xN monochrome halftone Forms */

		halftoneBits = interpreterProxy.fetchPointerofObject(FormBitsIndex, halftoneForm);
		halftoneHeight = interpreterProxy.fetchIntegerofObject(FormHeightIndex, halftoneForm);
		if (!interpreterProxy.isWords(halftoneBits)) {
			noHalftone = true;
		}
	} else {

		/* New spec accepts, basically, a word array */

		if (!(!interpreterProxy.isPointers(halftoneForm) && (interpreterProxy.isWords(halftoneForm)))) {
			return false;
		}
		halftoneBits = halftoneForm;
		halftoneHeight = SIZEOF(halftoneBits);
	}
	halftoneBase = halftoneBits.wordsOrBytes();
	return true;
}


/*	Load the surface support plugin */

function loadSurfacePlugin() {
	querySurfaceFn = interpreterProxy.ioLoadFunctionFrom("ioGetSurfaceFormat", "SurfacePlugin");
	lockSurfaceFn = interpreterProxy.ioLoadFunctionFrom("ioLockSurface", "SurfacePlugin");
	unlockSurfaceFn = interpreterProxy.ioLoadFunctionFrom("ioUnlockSurface", "SurfacePlugin");
	return (!!querySurfaceFn) && ((!!lockSurfaceFn) && (!!unlockSurfaceFn));
}

function loadWarpBltFrom(bbObj) {
	return loadBitBltFromwarping(bbObj, true);
}


/*	Get a pointer to the bits of any OS surfaces. */
/*	Notes: 
	* For equal source/dest handles only one locking operation is performed.
	This is to prevent locking of overlapping areas which does not work with
	certain APIs (as an example, DirectDraw prevents locking of overlapping areas). 
	A special case for non-overlapping but equal source/dest handle would 
	be possible but we would have to transfer this information over to 
	unlockSurfaces somehow (currently, only one unlock operation is 
	performed for equal source and dest handles). Also, this would require
	a change in the notion of ioLockSurface() which is right now interpreted
	as a hint and not as a requirement to lock only the specific portion of
	the surface.

	* The arguments in ioLockSurface() provide the implementation with
	an explicit hint what area is affected. It can be very useful to
	know the max. affected area beforehand if getting the bits requires expensive
	copy operations (e.g., like a roundtrip to the X server or a glReadPixel op).
	However, the returned pointer *MUST* point to the virtual origin of the surface
	and not to the beginning of the rectangle. The promise made by BitBlt
	is to never access data outside the given rectangle (aligned to 4byte boundaries!)
	so it is okay to return a pointer to the virtual origin that is actually outside
	the valid memory area.

	* The area provided in ioLockSurface() is already clipped (e.g., it will always
	be inside the source and dest boundingBox) but it is not aligned to word boundaries
	yet. It is up to the support code to compute accurate alignment if necessary.

	* Warping always requires the entire source surface to be locked because
	there is no beforehand knowledge about what area will actually be traversed.

	 */

function lockSurfaces() {
	var destHandle;
	var sourceHandle;
	var t;
	var fn;
	var r;
	var b;
	var l;

	hasSurfaceLock = false;
	if (destBits === 0) {

		/* Blitting *to* OS surface */

		if (!lockSurfaceFn) {
			if (!loadSurfacePlugin()) {
				return null;
			}
		}
		fn = lockSurfaceFn;
		destHandle = interpreterProxy.fetchIntegerofObject(FormBitsIndex, destForm);
		if ((sourceBits === 0) && (!noSource)) {

			/* Handle the special case of equal source and dest handles */

			sourceHandle = interpreterProxy.fetchIntegerofObject(FormBitsIndex, sourceForm);
			if (sourceHandle === destHandle) {

				/* If we have overlapping source/dest we lock the entire area
				so that there is only one area transmitted */

				if (isWarping) {

					/* Otherwise use overlapping area */

					l = Math.min(sx, dx);
					r = Math.max(sx, dx) + bbW;
					t = Math.min(sy, dy);
					b = Math.max(sy, dy) + bbH;
					sourceBits = fn(sourceHandle, function(p){sourcePitch = p}, l, t, r-l, b-t);
				} else {

					/* When warping we always need the entire surface for the source */

					sourceBits = fn(sourceHandle, function(p){sourcePitch = p}, 0,0, sourceWidth, sourceHeight);
				}
				destBits = sourceBits;
				destPitch = sourcePitch;
				hasSurfaceLock = true;
				return destBits !== 0;
			}
		}
		destBits = fn(destHandle, function(p){destPitch = p}, dx, dy, bbW, bbH);
		hasSurfaceLock = true;
	}
	if ((sourceBits === 0) && (!noSource)) {

		/* Blitting *from* OS surface */

		sourceHandle = interpreterProxy.fetchIntegerofObject(FormBitsIndex, sourceForm);
		if (!lockSurfaceFn) {
			if (!loadSurfacePlugin()) {
				return null;
			}
		}

		/* Warping requiring the entire surface */

		fn = lockSurfaceFn;
		if (isWarping) {
			sourceBits = fn(sourceHandle, function(p){sourcePitch = p}, 0, 0, sourceWidth, sourceHeight);
		} else {
			sourceBits = fn(sourceHandle, function(p){sourcePitch = p}, sx, sy, bbW, bbH);
		}
		hasSurfaceLock = true;
	}
	return (destBits !== 0) && ((sourceBits !== 0) || (noSource));
}


/*	Color map the given source pixel. */

function mapPixelflags(sourcePixel, mapperFlags) {
	var pv;

	pv = sourcePixel;
	if ((mapperFlags & ColorMapPresent) !== 0) {
		if ((mapperFlags & ColorMapFixedPart) !== 0) {

			/* avoid introducing transparency by color reduction */

			pv = rgbMapPixelflags(sourcePixel, mapperFlags);
			if ((pv === 0) && (sourcePixel !== 0)) {
				pv = 1;
			}
		}
		if ((mapperFlags & ColorMapIndexedPart) !== 0) {
			pv = cmLookupTable[pv & cmMask];
		}
	}
	return pv;
}


/*	The module with the given name was just unloaded.
	Make sure we have no dangling references. */

function moduleUnloaded(aModuleName) {
	if (strcmp(aModuleName, "SurfacePlugin") === 0) {

		/* The surface plugin just shut down. How nasty. */

		querySurfaceFn = (lockSurfaceFn = (unlockSurfaceFn = 0));
	}
}


/*	AND word1 to word2 as nParts partitions of nBits each.
	Any field of word1 not all-ones is treated as all-zeroes.
	Used for erasing, eg, brush shapes prior to ORing in a color */

function partitionedANDtonBitsnPartitions(word1, word2, nBits, nParts) {
	var result;
	var i;
	var mask;


	/* partition mask starts at the right */

	mask = maskTable[nBits];
	result = 0;
	for (i = 1; i <= nParts; i++) {
		if ((word1 & mask) === mask) {
			result = result | (word2 & mask);
		}

		/* slide left to next partition */

		mask = SHL(mask, nBits);
	}
	return result;
}


/*	Add word1 to word2 as nParts partitions of nBits each.
	This is useful for packed pixels, or packed colors */
/*	Use unsigned int everywhere because it has a well known arithmetic model without undefined behavior w.r.t. overflow and shifts */

function partitionedAddtonBitscomponentMaskcarryOverflowMask(word1, word2, nBits, componentMask, carryOverflowMask) {
	var w2;
	var carryOverflow;
	var sum;
	var w1;


	/* mask to remove high bit of each component */

	w1 = word1 & carryOverflowMask;
	w2 = word2 & carryOverflowMask;

	/* sum without high bit to avoid overflowing over next component */

	sum = (word1 ^ w1) + (word2 ^ w2);

	/* detect overflow condition for saturating */

	carryOverflow = (w1 & w2) | ((w1 | w2) & sum);
	return ((sum ^ w1) ^ w2) | ((SHR(carryOverflow, (nBits - 1))) * componentMask);
}


/*	Max word1 to word2 as nParts partitions of nBits each */
/*	In C, most arithmetic operations answer the same bit pattern regardless of the operands being signed or unsigned ints
	(this is due to the way 2's complement numbers work). However, comparisions might fail. Add the proper declaration of
	words as unsigned int in those cases where comparisions are done (jmv) */

function partitionedMaxwithnBitsnPartitions(word1, word2, nBits, nParts) {
	var result;
	var i;
	var mask;


	/* partition mask starts at the right */

	mask = maskTable[nBits];
	result = 0;
	for (i = 1; i <= nParts; i++) {
		result = result | Math.max((word2 & mask), (word1 & mask));

		/* slide left to next partition */

		mask = SHL(mask, nBits);
	}
	return result;
}


/*	Min word1 to word2 as nParts partitions of nBits each */
/*	In C, most arithmetic operations answer the same bit pattern regardless of the operands being signed or unsigned ints
	(this is due to the way 2's complement numbers work). However, comparisions might fail. Add the proper declaration of
	words as unsigned int in those cases where comparisions are done (jmv) */

function partitionedMinwithnBitsnPartitions(word1, word2, nBits, nParts) {
	var result;
	var i;
	var mask;


	/* partition mask starts at the right */

	mask = maskTable[nBits];
	result = 0;
	for (i = 1; i <= nParts; i++) {
		result = result | Math.min((word2 & mask), (word1 & mask));

		/* slide left to next partition */

		mask = SHL(mask, nBits);
	}
	return result;
}


/*	Multiply word1 with word2 as nParts partitions of nBits each.
	This is useful for packed pixels, or packed colors.
	Bug in loop version when non-white background */
/*	In C, integer multiplication might answer a wrong value if the unsigned values are declared as signed.
	This problem does not affect this method, because the most significant bit (i.e. the sign bit) will
	always be zero (jmv) */

function partitionedMulwithnBitsnPartitions(word1, word2, nBits, nParts) {
	var dMask;
	var result;
	var product;
	var sMask;


	/* partition mask starts at the right */

	sMask = maskTable[nBits];
	dMask = SHL(sMask, nBits);

	/* optimized first step */

	result = SHR((((((word1 & sMask) + 1) * ((word2 & sMask) + 1)) - 1) & dMask), nBits);
	if (nParts === 1) {
		return result;
	}
	product = (((((SHR(word1, nBits)) & sMask) + 1) * (((SHR(word2, nBits)) & sMask) + 1)) - 1) & dMask;
	result = result | product;
	if (nParts === 2) {
		return result;
	}
	product = (((((SHR(word1, (2 * nBits))) & sMask) + 1) * (((SHR(word2, (2 * nBits))) & sMask) + 1)) - 1) & dMask;
	result = result | (SHL(product, nBits));
	if (nParts === 3) {
		return result;
	}
	product = (((((SHR(word1, (3 * nBits))) & sMask) + 1) * (((SHR(word2, (3 * nBits))) & sMask) + 1)) - 1) & dMask;
	result = result | (SHL(product, (2 * nBits)));
	return result;
}

function partitionedRgbComponentAlphadestnBitsnPartitions(sourceWord, destWord, nBits, nParts) {
	var p2;
	var result;
	var p1;
	var i;
	var v;
	var mask;


	/* partition mask starts at the right */

	mask = maskTable[nBits];
	result = 0;
	for (i = 1; i <= nParts; i++) {
		p1 = SHR((sourceWord & mask), ((i - 1) * nBits));
		p2 = SHR((destWord & mask), ((i - 1) * nBits));
		if (nBits !== 32) {
			if (nBits === 16) {
				p1 = rgbMap16To32(p1) | 4278190080;
				p2 = rgbMap16To32(p2) | 4278190080;
			} else {
				p1 = rgbMapfromto(p1, nBits, 32) | 4278190080;
				p2 = rgbMapfromto(p2, nBits, 32) | 4278190080;
			}
		}
		v = rgbComponentAlpha32with(p1, p2);
		if (nBits !== 32) {
			v = rgbMapfromto(v, 32, nBits);
		}
		result = result | (SHL(v, ((i - 1) * nBits)));

		/* slide left to next partition */

		mask = SHL(mask, nBits);
	}
	return result;
}


/*	Subtract word1 from word2 as nParts partitions of nBits each.
	This is useful for packed pixels, or packed colors */
/*	In C, most arithmetic operations answer the same bit pattern regardless of the operands being signed or unsigned ints
	(this is due to the way 2's complement numbers work). However, comparisions might fail. Add the proper declaration of
	words as unsigned int in those cases where comparisions are done (jmv) */

function partitionedSubfromnBitsnPartitions(word1, word2, nBits, nParts) {
	var p2;
	var result;
	var p1;
	var i;
	var mask;


	/* partition mask starts at the right */

	mask = maskTable[nBits];
	result = 0;
	for (i = 1; i <= nParts; i++) {
		p1 = word1 & mask;
		p2 = word2 & mask;
		if (p1 < p2) {

			/* result is really abs value of thedifference */

			result = result | (p2 - p1);
		} else {
			result = result | (p1 - p2);
		}

		/* slide left to next partition */

		mask = SHL(mask, nBits);
	}
	return result;
}


/*	Based on the values provided during setup choose and
	perform the appropriate inner loop function. */
/*	Should be inlined into caller for speed */

function performCopyLoop() {
	destMaskAndPointerInit();
	if (noSource) {

		/* Simple fill loop */

		copyLoopNoSource();
	} else {

		/* Loop using source and dest */

		checkSourceOverlap();
		if ((sourceDepth !== destDepth) || ((cmFlags !== 0) || (sourceMSB !== destMSB))) {

			/* If we must convert between pixel depths or use
			color lookups or swap pixels use the general version */

			copyLoopPixMap();
		} else {

			/* Otherwise we simple copy pixels and can use a faster version */

			sourceSkewAndPointerInit();
			copyLoop();
		}
	}
}


/*	Pick nPix pixels starting at srcBitIndex from the source, map by the
	color map, and justify them according to dstBitIndex in the resulting destWord. */

function pickSourcePixelsflagssrcMaskdestMasksrcShiftIncdstShiftInc(nPixels, mapperFlags, srcMask, dstMask, srcShiftInc, dstShiftInc) {
	var sourcePix;
	var srcShift;
	var sourceWord;
	var dstShift;
	var destPix;
	var nPix;
	var destWord;


	/* oh please */

	sourceWord = sourceBits[sourceIndex >>> 2];
	destWord = 0;

	/* Hint: Keep in register */

	srcShift = srcBitShift;

	/* Hint: Keep in register */

	dstShift = dstBitShift;

	/* always > 0 so we can use do { } while(--nPix); */

	nPix = nPixels;
	if (mapperFlags === (ColorMapPresent | ColorMapIndexedPart)) {

		/* a little optimization for (pretty crucial) blits using indexed lookups only */
		/* grab, colormap and mix in pixel */

		do {
			sourcePix = (SHR(sourceWord, srcShift)) & srcMask;
			destPix = cmLookupTable[sourcePix & cmMask];

			/* adjust dest pix index */

			destWord = destWord | (SHL((destPix & dstMask), dstShift));

			/* adjust source pix index */

			dstShift += dstShiftInc;
			if ((((srcShift += srcShiftInc)) & 4294967264) !== 0) {
				if (sourceMSB) {
					srcShift += 32;
				} else {
					srcShift -= 32;
				}
				sourceWord = sourceBits[(sourceIndex += 4) >>> 2];
			}
		} while(!(((--nPix)) === 0));
	} else {

		/* grab, colormap and mix in pixel */

		do {
			sourcePix = (SHR(sourceWord, srcShift)) & srcMask;
			destPix = mapPixelflags(sourcePix, mapperFlags);

			/* adjust dest pix index */

			destWord = destWord | (SHL((destPix & dstMask), dstShift));

			/* adjust source pix index */

			dstShift += dstShiftInc;
			if ((((srcShift += srcShiftInc)) & 4294967264) !== 0) {
				if (sourceMSB) {
					srcShift += 32;
				} else {
					srcShift -= 32;
				}
				sourceWord = sourceBits[(sourceIndex += 4) >>> 2];
			}
		} while(!(((--nPix)) === 0));
	}

	/* Store back */

	srcBitShift = srcShift;
	return destWord;
}


/*	Pick a single pixel from the source for WarpBlt.
	Note: This method is crucial for WarpBlt speed w/o smoothing
	and still relatively important when smoothing is used. */

function pickWarpPixelAtXy(xx, yy) {
	var sourcePix;
	var sourceWord;
	var srcIndex;
	var x;
	var y;


	/* *please* */
	/* note: it would be much faster if we could just
	avoid these stupid tests for being inside sourceForm. */

	if ((xx < 0) || ((yy < 0) || ((((x = xx >>> 14)) >= sourceWidth) || (((y = yy >>> 14)) >= sourceHeight)))) {
		return 0;
	}
	srcIndex = ((y * sourcePitch)) + ((SHR(x, warpAlignShift)) * 4);

	/* Extract pixel from word */

	sourceWord = sourceBits[srcIndex >>> 2];
	srcBitShift = warpBitShiftTable[x & warpAlignMask];
	sourcePix = (SHR(sourceWord, srcBitShift)) & warpSrcMask;
	return sourcePix;
}


/*	Clear all pixels in destinationWord for which the pixels of sourceWord have the same values. Used to clear areas of some constant color to zero. */

function pixClearwith(sourceWord, destinationWord) {
	var pv;
	var nBits;
	var result;
	var i;
	var mask;

	if (destDepth === 32) {
		if (sourceWord === destinationWord) {
			return 0;
		} else {
			return destinationWord;
		}
	}
	nBits = destDepth;

	/* partition mask starts at the right */

	mask = maskTable[nBits];
	result = 0;
	for (i = 1; i <= destPPW; i++) {
		pv = destinationWord & mask;
		if ((sourceWord & mask) === pv) {
			pv = 0;
		}
		result = result | pv;

		/* slide left to next partition */

		mask = SHL(mask, nBits);
	}
	return result;
}

function pixMaskwith(sourceWord, destinationWord) {
	return partitionedANDtonBitsnPartitions(~sourceWord, destinationWord, destDepth, destPPW);
}

function pixPaintwith(sourceWord, destinationWord) {
	if (sourceWord === 0) {
		return destinationWord;
	}
	return sourceWord | partitionedANDtonBitsnPartitions(~sourceWord, destinationWord, destDepth, destPPW);
}


/*	Swap the pixels in destWord */

function pixSwapwith(sourceWord, destWord) {
	var result;
	var shift;
	var lowMask;
	var highMask;
	var i;

	if (destPPW === 1) {
		return destWord;
	}
	result = 0;

	/* mask low pixel */

	lowMask = (SHL(1, destDepth)) - 1;

	/* mask high pixel */

	highMask = SHL(lowMask, ((destPPW - 1) * destDepth));
	shift = 32 - destDepth;
	result = result | ((SHL((destWord & lowMask), shift)) | (SHR((destWord & highMask), shift)));
	if (destPPW <= 2) {
		return result;
	}
	for (i = 2; i <= (destPPW >> 1); i++) {
		lowMask = SHL(lowMask, destDepth);
		highMask = SHR(highMask, destDepth);
		shift -= destDepth * 2;
		result = result | ((SHL((destWord & lowMask), shift)) | (SHR((destWord & highMask), shift)));
	}
	return result;
}


/*	Invoke the copyBits primitive. If the destination is the display, then copy it to the screen. */

function primitiveCopyBits() {
	var rcvr;

	rcvr = interpreterProxy.stackValue(interpreterProxy.methodArgumentCount());
	if (!loadBitBltFrom(rcvr)) {
		return interpreterProxy.primitiveFail();
	}
	copyBits();
	if (interpreterProxy.failed()) {
		return null;
	}
	showDisplayBits();
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(interpreterProxy.methodArgumentCount());
	if ((combinationRule === 22) || (combinationRule === 32)) {
		interpreterProxy.pop(1);
		return interpreterProxy.pushInteger(bitCount);
	}
}

function primitiveDisplayString() {
	var charIndex;
	var sourcePtr;
	var stopIndex;
	var bbObj;
	var xTable;
	var maxGlyph;
	var quickBlt;
	var glyphIndex;
	var glyphMap;
	var left;
	var kernDelta;
	var startIndex;
	var ascii;
	var sourceString;

	if (interpreterProxy.methodArgumentCount() !== 6) {
		return interpreterProxy.primitiveFail();
	}
	kernDelta = interpreterProxy.stackIntegerValue(0);
	xTable = interpreterProxy.stackObjectValue(1);
	glyphMap = interpreterProxy.stackObjectValue(2);
	if (!((CLASSOF(xTable) === interpreterProxy.classArray()) && (CLASSOF(glyphMap) === interpreterProxy.classArray()))) {
		return interpreterProxy.primitiveFail();
	}
	if (SIZEOF(glyphMap) !== 256) {
		return interpreterProxy.primitiveFail();
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	maxGlyph = SIZEOF(xTable) - 2;
	stopIndex = interpreterProxy.stackIntegerValue(3);
	startIndex = interpreterProxy.stackIntegerValue(4);
	sourceString = interpreterProxy.stackObjectValue(5);
	if (!interpreterProxy.isBytes(sourceString)) {
		return interpreterProxy.primitiveFail();
	}
	if (!((startIndex > 0) && ((stopIndex > 0) && (stopIndex <= BYTESIZEOF(sourceString))))) {
		return interpreterProxy.primitiveFail();
	}
	bbObj = interpreterProxy.stackObjectValue(6);
	if (!loadBitBltFrom(bbObj)) {
		return interpreterProxy.primitiveFail();
	}
	if ((combinationRule === 30) || (combinationRule === 31)) {

		/* needs extra source alpha */

		return interpreterProxy.primitiveFail();
	}
	quickBlt = (destBits !== 0) && ((sourceBits !== 0) && ((noSource === false) && ((sourceForm !== destForm) && ((cmFlags !== 0) || ((sourceMSB !== destMSB) || (sourceDepth !== destDepth))))));
	left = destX;
	sourcePtr = sourceString.bytes;
	for (charIndex = startIndex; charIndex <= stopIndex; charIndex++) {
		ascii = sourcePtr[charIndex - 1];
		glyphIndex = interpreterProxy.fetchIntegerofObject(ascii, glyphMap);
		if ((glyphIndex < 0) || (glyphIndex > maxGlyph)) {
			return interpreterProxy.primitiveFail();
		}
		sourceX = interpreterProxy.fetchIntegerofObject(glyphIndex, xTable);
		width = interpreterProxy.fetchIntegerofObject(glyphIndex + 1, xTable) - sourceX;
		if (interpreterProxy.failed()) {
			return null;
		}
		clipRange();
		if ((bbW > 0) && (bbH > 0)) {
			if (quickBlt) {
				destMaskAndPointerInit();
				copyLoopPixMap();
				affectedL = dx;
				affectedR = dx + bbW;
				affectedT = dy;
				affectedB = dy + bbH;
			} else {
				copyBits();
			}
		}
		if (interpreterProxy.failed()) {
			return null;
		}
		destX = (destX + width) + kernDelta;
	}
	affectedL = left;
	showDisplayBits();
	interpreterProxy.storeIntegerofObjectwithValue(BBDestXIndex, bbObj, destX);
	interpreterProxy.pop(6);
}


/*	Invoke the line drawing primitive. */

function primitiveDrawLoop() {
	var yDelta;
	var rcvr;
	var xDelta;

	rcvr = interpreterProxy.stackValue(2);
	xDelta = interpreterProxy.stackIntegerValue(1);
	yDelta = interpreterProxy.stackIntegerValue(0);
	if (!loadBitBltFrom(rcvr)) {
		return interpreterProxy.primitiveFail();
	}
	if (!interpreterProxy.failed()) {
		drawLoopXY(xDelta, yDelta);
		showDisplayBits();
	}
	if (!interpreterProxy.failed()) {
		interpreterProxy.pop(2);
	}
}


/*	returns the single pixel at x@y.
	It does not handle LSB bitmaps right now.
	If x or y are < 0, return 0 to indicate transparent (cf BitBlt>bitPeekerFromForm: usage).
	Likewise if x>width or y>depth.
	Fail if the rcvr doesn't seem to be a Form, or x|y seem wrong */

function primitivePixelValueAt() {
	var pixel;
	var rcvr;
	var shift;
	var depth;
	var bitmap;
	var ppW;
	var word;
	var stride;
	var bitsSize;
	var mask;
	var xVal;
	var yVal;
	var _return_value;

	xVal = interpreterProxy.stackIntegerValue(1);
	yVal = interpreterProxy.stackIntegerValue(0);
	rcvr = interpreterProxy.stackValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if ((xVal < 0) || (yVal < 0)) {
		_return_value = 0;
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(3, _return_value);
		return null;
	}
	rcvr = interpreterProxy.stackValue(interpreterProxy.methodArgumentCount());
	if (!(interpreterProxy.isPointers(rcvr) && (SIZEOF(rcvr) >= 4))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	bitmap = interpreterProxy.fetchPointerofObject(FormBitsIndex, rcvr);
	if (!interpreterProxy.isWordsOrBytes(bitmap)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	width = interpreterProxy.fetchIntegerofObject(FormWidthIndex, rcvr);
	height = interpreterProxy.fetchIntegerofObject(FormHeightIndex, rcvr);

	/* if width/height/depth are not integer, fail */

	depth = interpreterProxy.fetchIntegerofObject(FormDepthIndex, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	if ((xVal >= width) || (yVal >= height)) {
		_return_value = 0;
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(3, _return_value);
		return null;
	}
	if (depth < 0) {
		interpreterProxy.primitiveFail();
		return null;
	}

	/* pixels in each word */

	ppW = DIV(32, depth);

	/* how many words per row of pixels */

	stride = DIV((width + (ppW - 1)), ppW);
	bitsSize = BYTESIZEOF(bitmap);
	if (bitsSize !== ((stride * height) * 4)) {

		/* bytes per word */

		interpreterProxy.primitiveFail();
		return null;
	}

	/* load the word that contains our target */

	word = interpreterProxy.fetchLong32ofObject((yVal * stride) + (DIV(xVal, ppW)), bitmap);

	/* make a mask to isolate the pixel within that word */

	mask = SHR(4294967295, (32 - depth));

	/* this is the tricky MSB part - we mask the xVal to find how far into the word we need, then add 1 for the pixel we're looking for, then * depth to get the bit shift */

	shift = 32 - (((xVal & (ppW - 1)) + 1) * depth);

	/* shift, mask and dim the lights */

	pixel = (SHR(word, shift)) & mask;
	_return_value = interpreterProxy.positive32BitIntegerFor(pixel);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, _return_value);
	return null;
}


/*	Invoke the warpBits primitive. If the destination is the display, then copy it to the screen. */

function primitiveWarpBits() {
	var rcvr;

	rcvr = interpreterProxy.stackValue(interpreterProxy.methodArgumentCount());
	if (!loadWarpBltFrom(rcvr)) {
		return interpreterProxy.primitiveFail();
	}
	warpBits();
	if (interpreterProxy.failed()) {
		return null;
	}
	showDisplayBits();
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(interpreterProxy.methodArgumentCount());
}


/*	Query the dimension of an OS surface.
	This method is provided so that in case the inst vars of the
	source form are broken, *actual* values of the OS surface
	can be obtained. This might, for instance, happen if the user
	resizes the main window.
	Note: Moved to a separate function for better inlining of the caller. */

function queryDestSurface(handle) {
	if (!querySurfaceFn) {
		if (!loadSurfacePlugin()) {
			return false;
		}
	}
	return querySurfaceFn(handle, function(w, h, d, m){destWidth = w; destHeight = h; destDepth = d; destMSB = m; });
}


/*	Query the dimension of an OS surface.
	This method is provided so that in case the inst vars of the
	source form are broken, *actual* values of the OS surface
	can be obtained. This might, for instance, happen if the user
	resizes the main window.
	Note: Moved to a separate function for better inlining of the caller. */

function querySourceSurface(handle) {
	if (!querySurfaceFn) {
		if (!loadSurfacePlugin()) {
			return false;
		}
	}
	return querySurfaceFn(handle, function(w, h, d, m){sourceWidth = w; sourceHeight = h; sourceDepth = d; sourceMSB = m; });
}

function rgbAddwith(sourceWord, destinationWord) {
	var carryOverflowMask;
	var componentMask;

	if (destDepth < 16) {

		/* Add each pixel separately */

		componentMask = (SHL(1, destDepth)) - 1;
		carryOverflowMask = SHL((DIV(4294967295, componentMask)), (destDepth - 1));
		return partitionedAddtonBitscomponentMaskcarryOverflowMask(sourceWord, destinationWord, destDepth, componentMask, carryOverflowMask);
	}
	if (destDepth === 16) {

		/* Add RGB components of each pixel separately */

		componentMask = 31;
		carryOverflowMask = 1108361744;
		return partitionedAddtonBitscomponentMaskcarryOverflowMask(sourceWord & 2147450879, destinationWord & 2147450879, 5, componentMask, carryOverflowMask);
	} else {

		/* Add RGBA components of the pixel separately */

		componentMask = 255;
		carryOverflowMask = 2155905152;
		return partitionedAddtonBitscomponentMaskcarryOverflowMask(sourceWord, destinationWord, 8, componentMask, carryOverflowMask);
	}
}


/*	This version assumes 
		combinationRule = 41
		sourcePixSize = 32
		destPixSize = 16
		sourceForm ~= destForm.
	 */
/*	This particular method should be optimized in itself */

function rgbComponentAlpha16() {
	var ditherBase;
	var ditherThreshold;
	var srcShift;
	var sourceWord;
	var srcIndex;
	var deltaX;
	var dstIndex;
	var srcAlpha;
	var dstMask;
	var deltaY;
	var srcY;
	var destWord;
	var dstY;
	var ditherIndex;


	/* So we can pre-decrement */

	deltaY = bbH + 1;
	srcY = sy;
	dstY = dy;
	srcShift = (dx & 1) * 16;
	if (destMSB) {
		srcShift = 16 - srcShift;
	}

	/* This is the outer loop */

	mask1 = SHL(65535, (16 - srcShift));
	while (((--deltaY)) !== 0) {
		srcIndex = ((srcY * sourcePitch)) + (sx * 4);
		dstIndex = ((dstY * destPitch)) + ((dx >> 1) * 4);
		ditherBase = (dstY & 3) * 4;

		/* For pre-increment */

		ditherIndex = (sx & 3) - 1;

		/* So we can pre-decrement */

		deltaX = bbW + 1;
		dstMask = mask1;
		if (dstMask === 65535) {
			srcShift = 16;
		} else {
			srcShift = 0;
		}
		while (((--deltaX)) !== 0) {
			ditherThreshold = ditherMatrix4x4[ditherBase + ((ditherIndex = (ditherIndex + 1) & 3))];
			sourceWord = sourceBits[srcIndex >>> 2];
			srcAlpha = sourceWord & 16777215;
			if (srcAlpha !== 0) {

				/* 0 < srcAlpha */
				/* If we have to mix colors then just copy a single word */

				destWord = destBits[dstIndex >>> 2];
				destWord = destWord & ~dstMask;

				/* Expand from 16 to 32 bit by adding zero bits */

				destWord = SHR(destWord, srcShift);

				/* Mix colors */

				destWord = (((destWord & 31744) << 9) | ((destWord & 992) << 6)) | (((destWord & 31) << 3) | 4278190080);

				/* And dither */

				sourceWord = rgbComponentAlpha32with(sourceWord, destWord);
				sourceWord = dither32To16threshold(sourceWord, ditherThreshold);
				if (sourceWord === 0) {
					sourceWord = SHL(1, srcShift);
				} else {
					sourceWord = SHL(sourceWord, srcShift);
				}
				dstLongAtputmask(dstIndex, sourceWord, dstMask);
			}
			srcIndex += 4;
			if (destMSB) {
				if (srcShift === 0) {
					dstIndex += 4;
				}
			} else {
				if (srcShift !== 0) {
					dstIndex += 4;
				}
			}

			/* Toggle between 0 and 16 */

			srcShift = srcShift ^ 16;
			dstMask = ~dstMask;
		}
		++srcY;
		++dstY;
	}
}


/*	This version assumes 
		combinationRule = 41
		sourcePixSize = destPixSize = 32
		sourceForm ~= destForm.
	Note: The inner loop has been optimized for dealing
		with the special case of aR = aG = aB = 0 
	 */

function rgbComponentAlpha32() {
	var sourceWord;
	var srcIndex;
	var deltaX;
	var dstIndex;
	var srcAlpha;
	var deltaY;
	var srcY;
	var destWord;
	var dstY;


	/* This particular method should be optimized in itself */
	/* Give the compile a couple of hints */
	/* The following should be declared as pointers so the compiler will
	notice that they're used for accessing memory locations 
	(good to know on an Intel architecture) but then the increments
	would be different between ST code and C code so must hope the
	compiler notices what happens (MS Visual C does) */


	/* So we can pre-decrement */

	deltaY = bbH + 1;
	srcY = sy;

	/* This is the outer loop */

	dstY = dy;
	while (((--deltaY)) !== 0) {
		srcIndex = ((srcY * sourcePitch)) + (sx * 4);
		dstIndex = ((dstY * destPitch)) + (dx * 4);

		/* So we can pre-decrement */
		/* This is the inner loop */

		deltaX = bbW + 1;
		while (((--deltaX)) !== 0) {
			sourceWord = sourceBits[srcIndex >>> 2];
			srcAlpha = sourceWord & 16777215;
			if (srcAlpha === 0) {
				srcIndex += 4;

				/* Now skip as many words as possible, */

				dstIndex += 4;
				while ((((--deltaX)) !== 0) && ((((sourceWord = sourceBits[srcIndex >>> 2])) & 16777215) === 0)) {
					srcIndex += 4;
					dstIndex += 4;
				}
				++deltaX;
			} else {

				/* 0 < srcAlpha */
				/* If we have to mix colors then just copy a single word */

				destWord = destBits[dstIndex >>> 2];
				destWord = rgbComponentAlpha32with(sourceWord, destWord);
				destBits[dstIndex >>> 2] = destWord;
				srcIndex += 4;
				dstIndex += 4;
			}
		}
		++srcY;
		++dstY;
	}
}


/*	
	componentAlphaModeColor is the color,
	sourceWord contains an alpha value for each component of RGB
	each of which is encoded as0 meaning 0.0 and 255 meaning 1.0 .
	the rule is...
	
	color = componentAlphaModeColor.
	colorAlpha = componentAlphaModeAlpha.
	mask = sourceWord.
	dst.A =  colorAlpha + (1 - colorAlpha) * dst.A
      dst.R = color.R * mask.R * colorAlpha + (1 - (mask.R * colorAlpha)) * dst.R
      dst.G = color.G * mask.G * colorAlpha + (1 - (mask.G* colorAlpha)) * dst.G
      dst.B = color.B * mask.B * colorAlpha + (1 - (mask.B* colorAlpha)) * dst.B
	 */
/*	Do NOT inline this into optimized loops */

function rgbComponentAlpha32with(sourceWord, destinationWord) {
	var g;
	var srcColor;
	var aG;
	var d;
	var a;
	var aA;
	var aR;
	var dstMask;
	var srcAlpha;
	var r;
	var b;
	var aB;
	var alpha;
	var answer;
	var s;

	alpha = sourceWord;
	if (alpha === 0) {
		return destinationWord;
	}
	srcColor = componentAlphaModeColor;
	srcAlpha = componentAlphaModeAlpha & 255;
	aB = alpha & 255;
	alpha = alpha >>> 8;
	aG = alpha & 255;
	alpha = alpha >>> 8;
	aR = alpha & 255;
	alpha = alpha >>> 8;
	aA = alpha & 255;
	if (srcAlpha !== 255) {
		aA = (aA * srcAlpha) >>> 8;
		aR = (aR * srcAlpha) >>> 8;
		aG = (aG * srcAlpha) >>> 8;
		aB = (aB * srcAlpha) >>> 8;
	}
	dstMask = destinationWord;
	d = dstMask & 255;
	s = srcColor & 255;
	if (!!ungammaLookupTable) {
		d = ungammaLookupTable[d];
		s = ungammaLookupTable[s];
	}
	b = ((d * (255 - aB)) >>> 8) + ((s * aB) >>> 8);
	if (b > 255) {
		b = 255;
	}
	if (!!gammaLookupTable) {
		b = gammaLookupTable[b];
	}
	dstMask = dstMask >>> 8;
	srcColor = srcColor >>> 8;
	d = dstMask & 255;
	s = srcColor & 255;
	if (!!ungammaLookupTable) {
		d = ungammaLookupTable[d];
		s = ungammaLookupTable[s];
	}
	g = ((d * (255 - aG)) >>> 8) + ((s * aG) >>> 8);
	if (g > 255) {
		g = 255;
	}
	if (!!gammaLookupTable) {
		g = gammaLookupTable[g];
	}
	dstMask = dstMask >>> 8;
	srcColor = srcColor >>> 8;
	d = dstMask & 255;
	s = srcColor & 255;
	if (!!ungammaLookupTable) {
		d = ungammaLookupTable[d];
		s = ungammaLookupTable[s];
	}
	r = ((d * (255 - aR)) >>> 8) + ((s * aR) >>> 8);
	if (r > 255) {
		r = 255;
	}
	if (!!gammaLookupTable) {
		r = gammaLookupTable[r];
	}
	dstMask = dstMask >>> 8;
	srcColor = srcColor >>> 8;

	/* no need to gamma correct alpha value ? */

	a = (((dstMask & 255) * (255 - aA)) >>> 8) + aA;
	if (a > 255) {
		a = 255;
	}
	answer = (((((a << 8) + r) << 8) + g) << 8) + b;
	return answer;
}


/*	This version assumes 
		combinationRule = 41
		sourcePixSize = 32
		destPixSize = 8
		sourceForm ~= destForm.
	Note: This is not real blending since we don't have the source colors available.
	 */

function rgbComponentAlpha8() {
	var srcShift;
	var sourceWord;
	var srcIndex;
	var deltaX;
	var mappingTable;
	var dstIndex;
	var adjust;
	var mapperFlags;
	var srcAlpha;
	var dstMask;
	var deltaY;
	var srcY;
	var destWord;
	var dstY;


	/* This particular method should be optimized in itself */

	mappingTable = default8To32Table();
	mapperFlags = cmFlags & ~ColorMapNewStyle;

	/* So we can pre-decrement */

	deltaY = bbH + 1;
	srcY = sy;
	dstY = dy;
	mask1 = (dx & 3) * 8;
	if (destMSB) {
		mask1 = 24 - mask1;
	}
	mask2 = AllOnes ^ (SHL(255, mask1));
	if ((dx & 1) === 0) {
		adjust = 0;
	} else {
		adjust = 522133279;
	}
	if ((dy & 1) === 0) {
		adjust = adjust ^ 522133279;
	}
	while (((--deltaY)) !== 0) {
		adjust = adjust ^ 522133279;
		srcIndex = ((srcY * sourcePitch)) + (sx * 4);
		dstIndex = ((dstY * destPitch)) + ((dx >> 2) * 4);

		/* So we can pre-decrement */

		deltaX = bbW + 1;
		srcShift = mask1;

		/* This is the inner loop */

		dstMask = mask2;
		while (((--deltaX)) !== 0) {
			sourceWord = (sourceBits[srcIndex >>> 2] & ~adjust) + adjust;

			/* set srcAlpha to the average of the 3 separate aR,Ag,AB values */

			srcAlpha = sourceWord & 16777215;
			srcAlpha = DIV((((srcAlpha >>> 16) + ((srcAlpha >>> 8) & 255)) + (srcAlpha & 255)), 3);
			if (srcAlpha > 31) {

				/* Everything below 31 is transparent */

				if (srcAlpha > 224) {

					/* treat everything above 224 as opaque */

					sourceWord = 4294967295;
				}
				destWord = destBits[dstIndex >>> 2];
				destWord = destWord & ~dstMask;
				destWord = SHR(destWord, srcShift);
				destWord = mappingTable[destWord];
				sourceWord = rgbComponentAlpha32with(sourceWord, destWord);
				sourceWord = mapPixelflags(sourceWord, mapperFlags);

				/* Store back */

				sourceWord = SHL(sourceWord, srcShift);
				dstLongAtputmask(dstIndex, sourceWord, dstMask);
			}
			srcIndex += 4;
			if (destMSB) {
				if (srcShift === 0) {
					dstIndex += 4;
					srcShift = 24;
					dstMask = 16777215;
				} else {
					srcShift -= 8;
					dstMask = (dstMask >>> 8) | 4278190080;
				}
			} else {
				if (srcShift === 32) {
					dstIndex += 4;
					srcShift = 0;
					dstMask = 4294967040;
				} else {
					srcShift += 8;
					dstMask = (dstMask << 8) | 255;
				}
			}
			adjust = adjust ^ 522133279;
		}
		++srcY;
		++dstY;
	}
}


/*	
	componentAlphaModeColor is the color,
	sourceWord contains an alpha value for each component of RGB
	each of which is encoded as0 meaning 0.0 and 255 meaning 1.0 .
	the rule is...
	
	color = componentAlphaModeColor.
	colorAlpha = componentAlphaModeAlpha.
	mask = sourceWord.
	dst.A =  colorAlpha + (1 - colorAlpha) * dst.A
      dst.R = color.R * mask.R * colorAlpha + (1 - (mask.R * colorAlpha)) * dst.R
      dst.G = color.G * mask.G * colorAlpha + (1 - (mask.G* colorAlpha)) * dst.G
      dst.B = color.B * mask.B * colorAlpha + (1 - (mask.B* colorAlpha)) * dst.B
	 */
/*	Do NOT inline this into optimized loops */

function rgbComponentAlphawith(sourceWord, destinationWord) {
	var alpha;

	alpha = sourceWord;
	if (alpha === 0) {
		return destinationWord;
	}
	return partitionedRgbComponentAlphadestnBitsnPartitions(sourceWord, destinationWord, destDepth, destPPW);
}


/*	Subract the pixels in the source and destination, color by color,
	and return the sum of the absolute value of all the differences.
	For non-rgb, return the number of differing pixels. */

function rgbDiffwith(sourceWord, destinationWord) {
	var sourcePixVal;
	var bitsPerColor;
	var diff;
	var sourceShifted;
	var pixMask;
	var rgbMask;
	var destShifted;
	var i;
	var maskShifted;
	var destPixVal;

	pixMask = maskTable[destDepth];
	if (destDepth === 16) {
		bitsPerColor = 5;
		rgbMask = 31;
	} else {
		bitsPerColor = 8;
		rgbMask = 255;
	}
	maskShifted = destMask;
	destShifted = destinationWord;
	sourceShifted = sourceWord;
	for (i = 1; i <= destPPW; i++) {
		if ((maskShifted & pixMask) > 0) {

			/* Only tally pixels within the destination rectangle */

			destPixVal = destShifted & pixMask;
			sourcePixVal = sourceShifted & pixMask;
			if (destDepth < 16) {
				if (sourcePixVal === destPixVal) {
					diff = 0;
				} else {
					diff = 1;
				}
			} else {
				diff = partitionedSubfromnBitsnPartitions(sourcePixVal, destPixVal, bitsPerColor, 3);
				diff = ((diff & rgbMask) + ((SHR(diff, bitsPerColor)) & rgbMask)) + ((SHR((SHR(diff, bitsPerColor)), bitsPerColor)) & rgbMask);
			}
			bitCount += diff;
		}
		maskShifted = SHR(maskShifted, destDepth);
		sourceShifted = SHR(sourceShifted, destDepth);
		destShifted = SHR(destShifted, destDepth);
	}
	return destinationWord;
}


/*	Convert the given 16bit pixel value to a 32bit RGBA value.
 	Note: This method is intended to deal with different source formats. */

function rgbMap16To32(sourcePixel) {
	return (((sourcePixel & 31) << 3) | ((sourcePixel & 992) << 6)) | ((sourcePixel & 31744) << 9);
}


/*	Convert the given 32bit pixel value to a 32bit RGBA value.
 	Note: This method is intended to deal with different source formats. */

function rgbMap32To32(sourcePixel) {
	return sourcePixel;
}


/*	Convert the given pixel value with nBitsIn bits for each color component to a pixel value with nBitsOut bits for each color component. Typical values for nBitsIn/nBitsOut are 3, 5, or 8. */

function rgbMapfromto(sourcePixel, nBitsIn, nBitsOut) {
	var d;
	var destPix;
	var srcPix;
	var mask;

	if (((d = nBitsOut - nBitsIn)) > 0) {

		/* Expand to more bits by zero-fill */


		/* Transfer mask */

		mask = (SHL(1, nBitsIn)) - 1;
		srcPix = SHL(sourcePixel, d);
		mask = SHL(mask, d);
		destPix = srcPix & mask;
		mask = SHL(mask, nBitsOut);
		srcPix = SHL(srcPix, d);
		return (destPix + (srcPix & mask)) + ((SHL(srcPix, d)) & (SHL(mask, nBitsOut)));
	} else {

		/* Compress to fewer bits by truncation */

		if (d === 0) {
			if (nBitsIn === 5) {

				/* Sometimes called with 16 bits, though pixel is 15,
					but we must never return more than 15. */

				return sourcePixel & 32767;
			}
			if (nBitsIn === 8) {

				/* Sometimes called with 32 bits, though pixel is 24,
					but we must never return more than 24. */

				return sourcePixel & 16777215;
			}
			return sourcePixel;
		}
		if (sourcePixel === 0) {
			return sourcePixel;
		}
		d = nBitsIn - nBitsOut;

		/* Transfer mask */

		mask = (SHL(1, nBitsOut)) - 1;
		srcPix = SHR(sourcePixel, d);
		destPix = srcPix & mask;
		mask = SHL(mask, nBitsOut);
		srcPix = SHR(srcPix, d);
		destPix = (destPix + (srcPix & mask)) + ((SHR(srcPix, d)) & (SHL(mask, nBitsOut)));
		if (destPix === 0) {
			return 1;
		}
		return destPix;
	}
}


/*	Perform the RGBA conversion for the given source pixel */

function rgbMapPixelflags(sourcePixel, mapperFlags) {
	var val;

	val = SHIFT((sourcePixel & cmMaskTable[0]), cmShiftTable[0]);
	val = val | (SHIFT((sourcePixel & cmMaskTable[1]), cmShiftTable[1]));
	val = val | (SHIFT((sourcePixel & cmMaskTable[2]), cmShiftTable[2]));
	return val | (SHIFT((sourcePixel & cmMaskTable[3]), cmShiftTable[3]));
}

function rgbMaxwith(sourceWord, destinationWord) {
	if (destDepth < 16) {

		/* Max each pixel separately */

		return partitionedMaxwithnBitsnPartitions(sourceWord, destinationWord, destDepth, destPPW);
	}
	if (destDepth === 16) {

		/* Max RGB components of each pixel separately */

		return partitionedMaxwithnBitsnPartitions(sourceWord, destinationWord, 5, 3) + (partitionedMaxwithnBitsnPartitions(sourceWord >>> 16, destinationWord >>> 16, 5, 3) << 16);
	} else {

		/* Max RGBA components of the pixel separately */

		return partitionedMaxwithnBitsnPartitions(sourceWord, destinationWord, 8, 4);
	}
}

function rgbMinwith(sourceWord, destinationWord) {
	if (destDepth < 16) {

		/* Min each pixel separately */

		return partitionedMinwithnBitsnPartitions(sourceWord, destinationWord, destDepth, destPPW);
	}
	if (destDepth === 16) {

		/* Min RGB components of each pixel separately */

		return partitionedMinwithnBitsnPartitions(sourceWord, destinationWord, 5, 3) + (partitionedMinwithnBitsnPartitions(sourceWord >>> 16, destinationWord >>> 16, 5, 3) << 16);
	} else {

		/* Min RGBA components of the pixel separately */

		return partitionedMinwithnBitsnPartitions(sourceWord, destinationWord, 8, 4);
	}
}

function rgbMinInvertwith(wordToInvert, destinationWord) {
	var sourceWord;

	sourceWord = ~wordToInvert;
	if (destDepth < 16) {

		/* Min each pixel separately */

		return partitionedMinwithnBitsnPartitions(sourceWord, destinationWord, destDepth, destPPW);
	}
	if (destDepth === 16) {

		/* Min RGB components of each pixel separately */

		return partitionedMinwithnBitsnPartitions(sourceWord, destinationWord, 5, 3) + (partitionedMinwithnBitsnPartitions(sourceWord >>> 16, destinationWord >>> 16, 5, 3) << 16);
	} else {

		/* Min RGBA components of the pixel separately */

		return partitionedMinwithnBitsnPartitions(sourceWord, destinationWord, 8, 4);
	}
}

function rgbMulwith(sourceWord, destinationWord) {
	if (destDepth < 16) {

		/* Mul each pixel separately */

		return partitionedMulwithnBitsnPartitions(sourceWord, destinationWord, destDepth, destPPW);
	}
	if (destDepth === 16) {

		/* Mul RGB components of each pixel separately */

		return partitionedMulwithnBitsnPartitions(sourceWord, destinationWord, 5, 3) + (partitionedMulwithnBitsnPartitions(sourceWord >>> 16, destinationWord >>> 16, 5, 3) << 16);
	} else {

		/* Mul RGBA components of the pixel separately */

		return partitionedMulwithnBitsnPartitions(sourceWord, destinationWord, 8, 4);
	}
}

function rgbSubwith(sourceWord, destinationWord) {
	if (destDepth < 16) {

		/* Sub each pixel separately */

		return partitionedSubfromnBitsnPartitions(sourceWord, destinationWord, destDepth, destPPW);
	}
	if (destDepth === 16) {

		/* Sub RGB components of each pixel separately */

		return partitionedSubfromnBitsnPartitions(sourceWord, destinationWord, 5, 3) + (partitionedSubfromnBitsnPartitions(sourceWord >>> 16, destinationWord >>> 16, 5, 3) << 16);
	} else {

		/* Sub RGBA components of the pixel separately */

		return partitionedSubfromnBitsnPartitions(sourceWord, destinationWord, 8, 4);
	}
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


/*	WARNING: For WarpBlt w/ smoothing the source depth is wrong here! */

function setupColorMasks() {
	var bits;
	var targetBits;

	bits = (targetBits = 0);
	if (sourceDepth <= 8) {
		return null;
	}
	if (sourceDepth === 16) {
		bits = 5;
	}
	if (sourceDepth === 32) {
		bits = 8;
	}
	if (cmBitsPerColor === 0) {

		/* Convert to destDepth */

		if (destDepth <= 8) {
			return null;
		}
		if (destDepth === 16) {
			targetBits = 5;
		}
		if (destDepth === 32) {
			targetBits = 8;
		}
	} else {
		targetBits = cmBitsPerColor;
	}
	setupColorMasksFromto(bits, targetBits);
}


/*	Setup color masks for converting an incoming RGB pixel value from srcBits to targetBits. */

function setupColorMasksFromto(srcBits, targetBits) {
	var shifts = [0, 0, 0, 0];
	var masks = [0, 0, 0, 0];
	var deltaBits;
	var mask;

	;
	deltaBits = targetBits - srcBits;
	if (deltaBits === 0) {
		return 0;
	}
	if (deltaBits <= 0) {

		/* Mask for extracting a color part of the source */

		mask = (SHL(1, targetBits)) - 1;
		masks[RedIndex] = (SHL(mask, ((srcBits * 2) - deltaBits)));
		masks[GreenIndex] = (SHL(mask, (srcBits - deltaBits)));
		masks[BlueIndex] = (SHL(mask, (0 - deltaBits)));
		masks[AlphaIndex] = 0;
	} else {

		/* Mask for extracting a color part of the source */

		mask = (SHL(1, srcBits)) - 1;
		masks[RedIndex] = (SHL(mask, (srcBits * 2)));
		masks[GreenIndex] = (SHL(mask, srcBits));
		masks[BlueIndex] = mask;
	}
	shifts[RedIndex] = (deltaBits * 3);
	shifts[GreenIndex] = (deltaBits * 2);
	shifts[BlueIndex] = deltaBits;
	shifts[AlphaIndex] = 0;
	cmShiftTable = shifts;
	cmMaskTable = masks;
	cmFlags = cmFlags | (ColorMapPresent | ColorMapFixedPart);
}

function showDisplayBits() {
	interpreterProxy.showDisplayBitsLeftTopRightBottom(destForm, affectedL, affectedT, affectedR, affectedB);
}


/*	This is only used when source and dest are same depth,
	ie, when the barrel-shift copy loop is used. */

function sourceSkewAndPointerInit() {
	var dxLowBits;
	var sxLowBits;
	var dWid;
	var pixPerM1;


	/* A mask, assuming power of two */

	pixPerM1 = destPPW - 1;
	sxLowBits = sx & pixPerM1;

	/* check if need to preload buffer
	(i.e., two words of source needed for first word of destination) */

	dxLowBits = dx & pixPerM1;
	if (hDir > 0) {

		/* n Bits stored in 1st word of dest */

		dWid = Math.min(bbW, (destPPW - dxLowBits));
		preload = (sxLowBits + dWid) > pixPerM1;
	} else {
		dWid = Math.min(bbW, (dxLowBits + 1));
		preload = ((sxLowBits - dWid) + 1) < 0;
	}
	if (sourceMSB) {
		skew = (sxLowBits - dxLowBits) * destDepth;
	} else {
		skew = (dxLowBits - sxLowBits) * destDepth;
	}
	if (preload) {
		if (skew < 0) {
			skew += 32;
		} else {
			skew -= 32;
		}
	}

	/* calculate increments from end of 1 line to start of next */

	sourceIndex = ((sy * sourcePitch)) + ((DIV(sx, (DIV(32, sourceDepth)))) * 4);
	sourceDelta = (sourcePitch * vDir) - (4 * (nWords * hDir));
	if (preload) {

		/* Compensate for extra source word fetched */

		sourceDelta -= 4 * hDir;
	}
}

function sourceWordwith(sourceWord, destinationWord) {
	return sourceWord;
}

function subWordwith(sourceWord, destinationWord) {
	return sourceWord - destinationWord;
}


/*	Tally pixels into the color map.  Those tallied are exactly those
	in the destination rectangle.  Note that the source should be 
	specified == destination, in order for the proper color map checks 
	to be performed at setup. */

function tallyIntoMapwith(sourceWord, destinationWord) {
	var pixMask;
	var mapIndex;
	var destShifted;
	var i;
	var maskShifted;
	var pixVal;

	if ((cmFlags & (ColorMapPresent | ColorMapIndexedPart)) !== (ColorMapPresent | ColorMapIndexedPart)) {
		return destinationWord;
	}
	pixMask = maskTable[destDepth];
	destShifted = destinationWord;
	maskShifted = destMask;
	for (i = 1; i <= destPPW; i++) {
		if ((maskShifted & pixMask) !== 0) {

			/* Only tally pixels within the destination rectangle */

			pixVal = destShifted & pixMask;
			if (destDepth < 16) {
				mapIndex = pixVal;
			} else {
				if (destDepth === 16) {
					mapIndex = rgbMapfromto(pixVal, 5, cmBitsPerColor);
				} else {
					mapIndex = rgbMapfromto(pixVal, 8, cmBitsPerColor);
				}
			}
			tallyMapAtput(mapIndex, tallyMapAt(mapIndex) + 1);
		}
		maskShifted = SHR(maskShifted, destDepth);
		destShifted = SHR(destShifted, destDepth);
	}
	return destinationWord;
}


/*	Return the word at position idx from the colorMap */

function tallyMapAt(idx) {
	return cmLookupTable[idx & cmMask];
}


/*	Store the word at position idx in the colorMap */

function tallyMapAtput(idx, value) {
	return cmLookupTable[idx & cmMask] = value;
}


/*	Shortcut for stuff that's being run from the balloon engine.
	Since we do this at each scan line we should avoid the expensive 
	setup for source and destination. */
/*	We need a source. */

function tryCopyingBitsQuickly() {
	if (noSource) {
		return false;
	}
	if (!((combinationRule === 34) || (combinationRule === 41))) {
		return false;
	}
	if (sourceDepth !== 32) {
		return false;
	}
	if (sourceForm === destForm) {
		return false;
	}
	if (combinationRule === 41) {
		if (destDepth === 32) {
			rgbComponentAlpha32();
			affectedL = dx;
			affectedR = dx + bbW;
			affectedT = dy;
			affectedB = dy + bbH;
			return true;
		}
		if (destDepth === 16) {
			rgbComponentAlpha16();
			affectedL = dx;
			affectedR = dx + bbW;
			affectedT = dy;
			affectedB = dy + bbH;
			return true;
		}
		if (destDepth === 8) {
			rgbComponentAlpha8();
			affectedL = dx;
			affectedR = dx + bbW;
			affectedT = dy;
			affectedB = dy + bbH;
			return true;
		}
		return false;
	}
	if (destDepth < 8) {
		return false;
	}
	if ((destDepth === 8) && ((cmFlags & ColorMapPresent) === 0)) {
		return false;
	}
	if (destDepth === 32) {
		alphaSourceBlendBits32();
	}
	if (destDepth === 16) {
		alphaSourceBlendBits16();
	}
	if (destDepth === 8) {
		alphaSourceBlendBits8();
	}
	affectedL = dx;
	affectedR = dx + bbW;
	affectedT = dy;
	affectedB = dy + bbH;
	return true;
}


/*	Unlock the bits of any OS surfaces. */
/*	See the comment in lockSurfaces. Similar rules apply. That is, the area provided in ioUnlockSurface can be used to determine the dirty region after drawing. If a source is unlocked, then the area will be (0,0,0,0) to indicate that no portion is dirty. */

function unlockSurfaces() {
	var destHandle;
	var sourceHandle;
	var fn;
	var destLocked;

	if (hasSurfaceLock) {
		if (!unlockSurfaceFn) {
			if (!loadSurfacePlugin()) {
				return null;
			}
		}
		fn = unlockSurfaceFn;
		destLocked = false;
		destHandle = interpreterProxy.fetchPointerofObject(FormBitsIndex, destForm);
		if (typeof destHandle === "number") {

			/* The destBits are always assumed to be dirty */

			destHandle = destHandle;
			fn(destHandle, affectedL, affectedT, affectedR-affectedL, affectedB-affectedT);
			destBits = (destPitch = 0);
			destLocked = true;
		}
		if (!noSource) {
			sourceHandle = interpreterProxy.fetchPointerofObject(FormBitsIndex, sourceForm);
			if (typeof sourceHandle === "number") {

				/* Only unlock sourceHandle if different from destHandle */

				sourceHandle = sourceHandle;
				if (!(destLocked && (sourceHandle === destHandle))) {
					fn(sourceHandle, 0, 0, 0, 0);
				}
				sourceBits = (sourcePitch = 0);
			}
		}
		hasSurfaceLock = false;
	}
}

function warpBits() {
	var ns;

	ns = noSource;
	noSource = true;
	clipRange();
	noSource = ns;
	if (noSource || ((bbW <= 0) || (bbH <= 0))) {

		/* zero width or height; noop */

		affectedL = (affectedR = (affectedT = (affectedB = 0)));
		return null;
	}
	if (!lockSurfaces()) {
		return interpreterProxy.primitiveFail();
	}
	destMaskAndPointerInit();
	warpLoop();
	if (hDir > 0) {
		affectedL = dx;
		affectedR = dx + bbW;
	} else {
		affectedL = (dx - bbW) + 1;
		affectedR = dx + 1;
	}
	if (vDir > 0) {
		affectedT = dy;
		affectedB = dy + bbH;
	} else {
		affectedT = (dy - bbH) + 1;
		affectedB = dy + 1;
	}
	unlockSurfaces();
}


/*	This version of the inner loop traverses an arbirary quadrilateral
	source, thus producing a general affine transformation. */

function warpLoop() {
	var mapperFlags;
	var dstShiftLeft;
	var words;
	var skewWord;
	var nSteps;
	var deltaP43y;
	var destWord;
	var startBits;
	var mergeFnwith;
	var deltaP43x;
	var pBy;
	var i;
	var yDelta;
	var halftoneWord;
	var mergeWord;
	var pAy;
	var dstShiftInc;
	var pBx;
	var sourceMapOop;
	var xDelta;
	var pAx;
	var deltaP12y;
	var endBits;
	var nPix;
	var deltaP12x;
	var smoothingCount;

	mergeFnwith = opTable[combinationRule + 1];
	mergeFnwith;
	if (!(SIZEOF(bitBltOop) >= (BBWarpBase + 12))) {
		return interpreterProxy.primitiveFail();
	}
	nSteps = height - 1;
	if (nSteps <= 0) {
		nSteps = 1;
	}
	pAx = fetchIntOrFloatofObject(BBWarpBase, bitBltOop);
	words = fetchIntOrFloatofObject(BBWarpBase + 3, bitBltOop);
	deltaP12x = deltaFromtonSteps(pAx, words, nSteps);
	if (deltaP12x < 0) {
		pAx = words - (nSteps * deltaP12x);
	}
	pAy = fetchIntOrFloatofObject(BBWarpBase + 1, bitBltOop);
	words = fetchIntOrFloatofObject(BBWarpBase + 4, bitBltOop);
	deltaP12y = deltaFromtonSteps(pAy, words, nSteps);
	if (deltaP12y < 0) {
		pAy = words - (nSteps * deltaP12y);
	}
	pBx = fetchIntOrFloatofObject(BBWarpBase + 9, bitBltOop);
	words = fetchIntOrFloatofObject(BBWarpBase + 6, bitBltOop);
	deltaP43x = deltaFromtonSteps(pBx, words, nSteps);
	if (deltaP43x < 0) {
		pBx = words - (nSteps * deltaP43x);
	}
	pBy = fetchIntOrFloatofObject(BBWarpBase + 10, bitBltOop);
	words = fetchIntOrFloatofObject(BBWarpBase + 7, bitBltOop);
	deltaP43y = deltaFromtonSteps(pBy, words, nSteps);
	if (deltaP43y < 0) {
		pBy = words - (nSteps * deltaP43y);
	}
	if (interpreterProxy.failed()) {
		return false;
	}
	if (interpreterProxy.methodArgumentCount() === 2) {
		smoothingCount = interpreterProxy.stackIntegerValue(1);
		sourceMapOop = interpreterProxy.stackValue(0);
		if (sourceMapOop.isNil) {
			if (sourceDepth < 16) {

				/* color map is required to smooth non-RGB dest */

				return interpreterProxy.primitiveFail();
			}
		} else {
			if (SIZEOF(sourceMapOop) < (SHL(1, sourceDepth))) {

				/* sourceMap must be long enough for sourceDepth */

				return interpreterProxy.primitiveFail();
			}
			sourceMapOop = sourceMapOop.wordsOrBytes();
		}
	} else {
		smoothingCount = 1;
		sourceMapOop = interpreterProxy.nilObject();
	}
	nSteps = width - 1;
	if (nSteps <= 0) {
		nSteps = 1;
	}
	startBits = destPPW - (dx & (destPPW - 1));
	endBits = (((dx + bbW) - 1) & (destPPW - 1)) + 1;
	if (bbW < startBits) {
		startBits = bbW;
	}
	if (destY < clipY) {

		/* Advance increments if there was clipping in y */

		pAx += (clipY - destY) * deltaP12x;
		pAy += (clipY - destY) * deltaP12y;
		pBx += (clipY - destY) * deltaP43x;
		pBy += (clipY - destY) * deltaP43y;
	}
	warpLoopSetup();
	if ((smoothingCount > 1) && ((cmFlags & ColorMapNewStyle) === 0)) {
		if (!cmLookupTable) {
			if (destDepth === 16) {
				setupColorMasksFromto(8, 5);
			}
		} else {
			setupColorMasksFromto(8, cmBitsPerColor);
		}
	}
	mapperFlags = cmFlags & ~ColorMapNewStyle;
	if (destMSB) {
		dstShiftInc = 0 - destDepth;
		dstShiftLeft = 32 - destDepth;
	} else {
		dstShiftInc = destDepth;
		dstShiftLeft = 0;
	}
	for (i = 1; i <= bbH; i++) {

		/* here is the vertical loop... */

		xDelta = deltaFromtonSteps(pAx, pBx, nSteps);
		if (xDelta >= 0) {
			sx = pAx;
		} else {
			sx = pBx - (nSteps * xDelta);
		}
		yDelta = deltaFromtonSteps(pAy, pBy, nSteps);
		if (yDelta >= 0) {
			sy = pAy;
		} else {
			sy = pBy - (nSteps * yDelta);
		}
		if (destMSB) {
			dstBitShift = 32 - (((dx & (destPPW - 1)) + 1) * destDepth);
		} else {
			dstBitShift = (dx & (destPPW - 1)) * destDepth;
		}
		if (destX < clipX) {

			/* Advance increments if there was clipping in x */

			sx += (clipX - destX) * xDelta;
			sy += (clipX - destX) * yDelta;
		}
		if (noHalftone) {
			halftoneWord = AllOnes;
		} else {
			halftoneWord = halftoneAt((dy + i) - 1);
		}
		destMask = mask1;

		/* Here is the inner loop... */

		nPix = startBits;
		words = nWords;
		do {

			/* pick up word */

			if (smoothingCount === 1) {

				/* Faster if not smoothing */

				skewWord = warpPickSourcePixelsxDeltahyDeltahxDeltavyDeltavdstShiftIncflags(nPix, xDelta, yDelta, deltaP12x, deltaP12y, dstShiftInc, mapperFlags);
			} else {

				/* more difficult with smoothing */

				skewWord = warpPickSmoothPixelsxDeltahyDeltahxDeltavyDeltavsourceMapsmoothingdstShiftInc(nPix, xDelta, yDelta, deltaP12x, deltaP12y, sourceMapOop, smoothingCount, dstShiftInc);
			}
			dstBitShift = dstShiftLeft;
			if (destMask === AllOnes) {

				/* avoid read-modify-write */

				mergeWord = mergeFnwith(skewWord & halftoneWord, destBits[destIndex >>> 2]);
				destBits[destIndex >>> 2] = destMask & mergeWord;
			} else {

				/* General version using dest masking */

				destWord = destBits[destIndex >>> 2];
				mergeWord = mergeFnwith(skewWord & halftoneWord, destWord & destMask);
				destWord = (destMask & mergeWord) | (destWord & ~destMask);
				destBits[destIndex >>> 2] = destWord;
			}
			destIndex += 4;
			if (words === 2) {

				/* e.g., is the next word the last word? */
				/* set mask for last word in this row */

				destMask = mask2;
				nPix = endBits;
			} else {

				/* use fullword mask for inner loop */

				destMask = AllOnes;
				nPix = destPPW;
			}
		} while(!(((--words)) === 0));
		pAx += deltaP12x;
		pAy += deltaP12y;
		pBx += deltaP43x;
		pBy += deltaP43y;
		destIndex += destDelta;
	}
}


/*	Setup values for faster pixel fetching. */

function warpLoopSetup() {
	var i;
	var words;


	/* warpSrcShift = log2(sourceDepth) */

	warpSrcShift = 0;

	/* recycle temp */

	words = sourceDepth;
	while (!(words === 1)) {
		++warpSrcShift;
		words = words >>> 1;
	}

	/* warpAlignShift: Shift for aligning x position to word boundary */

	warpSrcMask = maskTable[sourceDepth];

	/* warpAlignMask: Mask for extracting the pixel position from an x position */

	warpAlignShift = 5 - warpSrcShift;

	/* Setup the lookup table for source bit shifts */
	/* warpBitShiftTable: given an sub-word x value what's the bit shift? */

	warpAlignMask = (SHL(1, warpAlignShift)) - 1;
	for (i = 0; i <= warpAlignMask; i++) {
		if (sourceMSB) {
			warpBitShiftTable[i] = (32 - (SHL((i + 1), warpSrcShift)));
		} else {
			warpBitShiftTable[i] = (SHL(i, warpSrcShift));
		}
	}
}


/*	Pick n (sub-) pixels from the source form, mapped by sourceMap,
	average the RGB values, map by colorMap and return the new word.
	This version is only called from WarpBlt with smoothingCount > 1 */

function warpPickSmoothPixelsxDeltahyDeltahxDeltavyDeltavsourceMapsmoothingdstShiftInc(nPixels, xDeltah, yDeltah, xDeltav, yDeltav, sourceMap, n, dstShiftInc) {
	var k;
	var destWord;
	var xdh;
	var j;
	var ydh;
	var i;
	var xdv;
	var dstMask;
	var ydv;
	var rgb;
	var y;
	var b;
	var yy;
	var g;
	var x;
	var a;
	var r;
	var nPix;
	var xx;


	/* nope - too much stuff in here */

	dstMask = maskTable[destDepth];
	destWord = 0;
	if (n === 2) {

		/* Try avoiding divides for most common n (divide by 2 is generated as shift) */

		xdh = xDeltah >> 1;
		ydh = yDeltah >> 1;
		xdv = xDeltav >> 1;
		ydv = yDeltav >> 1;
	} else {
		xdh = DIV(xDeltah, n);
		ydh = DIV(yDeltah, n);
		xdv = DIV(xDeltav, n);
		ydv = DIV(yDeltav, n);
	}
	i = nPixels;
	do {
		x = sx;
		y = sy;

		/* Pick and average n*n subpixels */

		a = (r = (g = (b = 0)));

		/* actual number of pixels (not clipped and not transparent) */

		nPix = 0;
		j = n;
		do {
			xx = x;
			yy = y;
			k = n;
			do {

				/* get a single subpixel */

				rgb = pickWarpPixelAtXy(xx, yy);
				if (!((combinationRule === 25) && (rgb === 0))) {

					/* If not clipped and not transparent, then tally rgb values */

					++nPix;
					if (sourceDepth < 16) {

						/* Get RGBA values from sourcemap table */

						rgb = sourceMap[rgb];
					} else {

						/* Already in RGB format */

						if (sourceDepth === 16) {
							rgb = rgbMap16To32(rgb);
						} else {
							rgb = rgbMap32To32(rgb);
						}
					}
					b += rgb & 255;
					g += (rgb >>> 8) & 255;
					r += (rgb >>> 16) & 255;
					a += rgb >>> 24;
				}
				xx += xdh;
				yy += ydh;
			} while(!(((--k)) === 0));
			x += xdv;
			y += ydv;
		} while(!(((--j)) === 0));
		if ((nPix === 0) || ((combinationRule === 25) && (nPix < ((n * n) >> 1)))) {

			/* All pixels were 0, or most were transparent */

			rgb = 0;
		} else {

			/* normalize rgba sums */

			if (nPix === 4) {

				/* Try to avoid divides for most common n */

				r = r >>> 2;
				g = g >>> 2;
				b = b >>> 2;
				a = a >>> 2;
			} else {
				r = DIV(r, nPix);
				g = DIV(g, nPix);
				b = DIV(b, nPix);
				a = DIV(a, nPix);
			}

			/* map the pixel */

			rgb = (((a << 24) + (r << 16)) + (g << 8)) + b;
			if (rgb === 0) {

				/* only generate zero if pixel is really transparent */

				if ((((r + g) + b) + a) > 0) {
					rgb = 1;
				}
			}
			rgb = mapPixelflags(rgb, cmFlags);
		}
		destWord = destWord | (SHL((rgb & dstMask), dstBitShift));
		dstBitShift += dstShiftInc;
		sx += xDeltah;
		sy += yDeltah;
	} while(!(((--i)) === 0));
	return destWord;
}


/*	Pick n pixels from the source form,
	map by colorMap and return aligned by dstBitShift.
	This version is only called from WarpBlt with smoothingCount = 1 */

function warpPickSourcePixelsxDeltahyDeltahxDeltavyDeltavdstShiftIncflags(nPixels, xDeltah, yDeltah, xDeltav, yDeltav, dstShiftInc, mapperFlags) {
	var sourcePix;
	var nPix;
	var destPix;
	var dstMask;
	var destWord;


	/* Yepp - this should go into warpLoop */

	dstMask = maskTable[destDepth];
	destWord = 0;
	nPix = nPixels;
	if (mapperFlags === (ColorMapPresent | ColorMapIndexedPart)) {

		/* a little optimization for (pretty crucial) blits using indexed lookups only */
		/* grab, colormap and mix in pixel */

		do {
			sourcePix = pickWarpPixelAtXy(sx, sy);
			destPix = cmLookupTable[sourcePix & cmMask];
			destWord = destWord | (SHL((destPix & dstMask), dstBitShift));
			dstBitShift += dstShiftInc;
			sx += xDeltah;
			sy += yDeltah;
		} while(!(((--nPix)) === 0));
	} else {

		/* grab, colormap and mix in pixel */

		do {
			sourcePix = pickWarpPixelAtXy(sx, sy);
			destPix = mapPixelflags(sourcePix, mapperFlags);
			destWord = destWord | (SHL((destPix & dstMask), dstBitShift));
			dstBitShift += dstShiftInc;
			sx += xDeltah;
			sy += yDeltah;
		} while(!(((--nPix)) === 0));
	}
	return destWord;
}


Squeak.registerExternalModule("BitBltPlugin", {
	primitiveCopyBits: primitiveCopyBits,
	copyBits: copyBits,
	moduleUnloaded: moduleUnloaded,
	primitiveDrawLoop: primitiveDrawLoop,
	primitiveDisplayString: primitiveDisplayString,
	initialiseModule: initialiseModule,
	loadBitBltFrom: loadBitBltFrom,
	setInterpreter: setInterpreter,
	primitiveWarpBits: primitiveWarpBits,
	getModuleName: getModuleName,
	primitivePixelValueAt: primitivePixelValueAt,
	copyBitsFromtoat: copyBitsFromtoat,
});

}); // end of module

/***** including ../plugins/DSAPrims.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:20 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	DSAPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.DSAPrims").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var divisorDigitCount = 0;
var dsaDivisor = null;
var dsaQuotient = null;
var dsaRemainder = null;
var interpreterProxy = null;
var moduleName = "DSAPrims 3 November 2014 (e)";
var remainderDigitCount = 0;



/*	Add back the divisor shifted left by the given number of digits. This is done only when the estimate of quotient digit was one larger than the correct value. */

function addBackDivisorDigitShift(digitShift) {
	var carry;
	var i;
	var rIndex;
	var sum;

	carry = 0;
	rIndex = digitShift + 1;
	for (i = 1; i <= divisorDigitCount; i++) {
		sum = (dsaRemainder[rIndex] + dsaDivisor[i]) + carry;
		dsaRemainder[rIndex] = (sum & 255);
		carry = sum >>> 8;
		++rIndex;
	}
	sum = dsaRemainder[rIndex] + carry;
	dsaRemainder[rIndex] = (sum & 255);
}


/*	This is the core of the divide algorithm. This loop steps through the digit positions of the quotient, each time estimating the right quotient digit, subtracting from the remainder the divisor times the quotient digit shifted left by the appropriate number of digits. When the loop terminates, all digits of the quotient have been filled in and the remainder contains a value less than the divisor. The tricky bit is estimating the next quotient digit. Knuth shows that the digit estimate computed here will never be less than it should be and cannot be more than one over what it should be. Furthermore, the case where the estimate is one too large is extremely rare. For example, in a typical test of 100000 random 60-bit division problems, the rare case only occured five times. See Knuth, volume 2 ('Semi-Numerical Algorithms') 2nd edition, pp. 257-260 */
/*	extract the top two digits of the divisor */

function bigDivideLoop() {
	var d1;
	var d2;
	var digitShift;
	var firstDigit;
	var firstTwoDigits;
	var j;
	var q;
	var qTooBig;
	var thirdDigit;

	d1 = dsaDivisor[divisorDigitCount];
	d2 = dsaDivisor[divisorDigitCount - 1];
	for (j = remainderDigitCount; j >= (divisorDigitCount + 1); j += -1) {

		/* extract the top several digits of remainder. */

		firstDigit = dsaRemainder[j];
		firstTwoDigits = (firstDigit << 8) + dsaRemainder[j - 1];

		/* estimate q, the next digit of the quotient */

		thirdDigit = dsaRemainder[j - 2];
		if (firstDigit === d1) {
			q = 255;
		} else {
			q = DIV(firstTwoDigits, d1);
		}
		if ((d2 * q) > (((firstTwoDigits - (q * d1)) << 8) + thirdDigit)) {
			--q;
			if ((d2 * q) > (((firstTwoDigits - (q * d1)) << 8) + thirdDigit)) {
				--q;
			}
		}
		digitShift = (j - divisorDigitCount) - 1;
		if (q > 0) {
			qTooBig = subtractDivisorMultipliedByDigitdigitShift(q, digitShift);
			if (qTooBig) {

				/* this case is extremely rare */

				addBackDivisorDigitShift(digitShift);
				--q;
			}
		}
		dsaQuotient[digitShift + 1] = q;
	}
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}


/*	Rotate the given 32-bit integer left by the given number of bits and answer the result. */

function leftRotateby(anInteger, bits) {
	return (SHL(anInteger, bits)) | (SHR(anInteger, (32 - bits)));
}


/*	Called with three LargePositiveInteger arguments, rem, div, quo. Divide div into rem and store the quotient into quo, leaving the remainder in rem. */
/*	Assume: quo starts out filled with zeros. */

function primitiveBigDivide() {
	var div;
	var quo;
	var rem;

	quo = interpreterProxy.stackObjectValue(0);
	div = interpreterProxy.stackObjectValue(1);
	rem = interpreterProxy.stackObjectValue(2);
	interpreterProxy.success(CLASSOF(rem) === interpreterProxy.classLargePositiveInteger());
	interpreterProxy.success(CLASSOF(div) === interpreterProxy.classLargePositiveInteger());
	interpreterProxy.success(CLASSOF(quo) === interpreterProxy.classLargePositiveInteger());
	if (interpreterProxy.failed()) {
		return null;
	}
	dsaRemainder = rem.bytes;
	dsaDivisor = div.bytes;
	dsaQuotient = quo.bytes;
	divisorDigitCount = SIZEOF(div);

	/* adjust pointers for base-1 indexing */

	remainderDigitCount = SIZEOF(rem);
	--dsaRemainder;
	--dsaDivisor;
	--dsaQuotient;
	bigDivideLoop();
	interpreterProxy.pop(3);
}


/*	Multiple f1 by f2, placing the result into prod. f1, f2, and prod must be LargePositiveIntegers, and the length of prod must be the sum of the lengths of f1 and f2. */
/*	Assume: prod starts out filled with zeros */

function primitiveBigMultiply() {
	var carry;
	var digit;
	var f1;
	var f1Len;
	var f1Ptr;
	var f2;
	var f2Len;
	var f2Ptr;
	var i;
	var j;
	var k;
	var prod;
	var prodLen;
	var prodPtr;
	var sum;

	prod = interpreterProxy.stackObjectValue(0);
	f2 = interpreterProxy.stackObjectValue(1);
	f1 = interpreterProxy.stackObjectValue(2);
	interpreterProxy.success(interpreterProxy.isBytes(prod));
	interpreterProxy.success(interpreterProxy.isBytes(f2));
	interpreterProxy.success(interpreterProxy.isBytes(f1));
	interpreterProxy.success(CLASSOF(prod) === interpreterProxy.classLargePositiveInteger());
	interpreterProxy.success(CLASSOF(f2) === interpreterProxy.classLargePositiveInteger());
	interpreterProxy.success(CLASSOF(f1) === interpreterProxy.classLargePositiveInteger());
	if (interpreterProxy.failed()) {
		return null;
	}
	prodLen = SIZEOF(prod);
	f1Len = SIZEOF(f1);
	f2Len = SIZEOF(f2);
	interpreterProxy.success(prodLen === (f1Len + f2Len));
	if (interpreterProxy.failed()) {
		return null;
	}
	prodPtr = prod.bytes;
	f2Ptr = f2.bytes;
	f1Ptr = f1.bytes;
	for (i = 0; i <= (f1Len - 1); i++) {
		if (((digit = f1Ptr[i])) !== 0) {
			carry = 0;

			/* Loop invariants: 0 <= carry <= 16rFF, k = i + j - 1 */

			k = i;
			for (j = 0; j <= (f2Len - 1); j++) {
				sum = ((f2Ptr[j] * digit) + prodPtr[k]) + carry;
				carry = sum >>> 8;
				prodPtr[k] = (sum & 255);
				++k;
			}
			prodPtr[k] = carry;
		}
	}
	interpreterProxy.pop(3);
}


/*	Expand a 64 byte ByteArray (the first argument) into and an Bitmap of 80 32-bit words (the second argument). When reading a 32-bit integer from the ByteArray, consider the first byte to contain the most significant bits of the word (i.e., use big-endian byte ordering). */

function primitiveExpandBlock() {
	var buf;
	var bytePtr;
	var expanded;
	var i;
	var src;
	var v;
	var wordPtr;

	expanded = interpreterProxy.stackObjectValue(0);
	buf = interpreterProxy.stackObjectValue(1);
	interpreterProxy.success(interpreterProxy.isWords(expanded));
	interpreterProxy.success(interpreterProxy.isBytes(buf));
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(SIZEOF(expanded) === 80);
	interpreterProxy.success(SIZEOF(buf) === 64);
	if (interpreterProxy.failed()) {
		return null;
	}
	wordPtr = expanded.words;
	bytePtr = buf.bytes;
	src = 0;
	for (i = 0; i <= 15; i++) {
		v = (((bytePtr[src] << 24) + (bytePtr[src + 1] << 16)) + (bytePtr[src + 2] << 8)) + bytePtr[src + 3];
		wordPtr[i] = v;
		src += 4;
	}
	for (i = 16; i <= 79; i++) {
		v = ((wordPtr[i - 3] ^ wordPtr[i - 8]) ^ wordPtr[i - 14]) ^ wordPtr[i - 16];
		v = leftRotateby(v, 1);
		wordPtr[i] = v;
	}
	interpreterProxy.pop(2);
}


/*	Answer true if the secure hash primitive is implemented. */

function primitiveHasSecureHashPrimitive() {
	interpreterProxy.pop(1);
	interpreterProxy.pushBool(true);
}


/*	Hash a Bitmap of 80 32-bit words (the first argument), using the given state (the second argument). */

function primitiveHashBlock() {
	var a;
	var b;
	var buf;
	var bufPtr;
	var c;
	var d;
	var e;
	var i;
	var state;
	var statePtr;
	var tmp;

	state = interpreterProxy.stackObjectValue(0);
	buf = interpreterProxy.stackObjectValue(1);
	interpreterProxy.success(interpreterProxy.isWords(state));
	interpreterProxy.success(interpreterProxy.isWords(buf));
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(SIZEOF(state) === 5);
	interpreterProxy.success(SIZEOF(buf) === 80);
	if (interpreterProxy.failed()) {
		return null;
	}
	statePtr = state.words;
	bufPtr = buf.words;
	a = statePtr[0];
	b = statePtr[1];
	c = statePtr[2];
	d = statePtr[3];
	e = statePtr[4];
	for (i = 0; i <= 19; i++) {
		tmp = (((1518500249 + ((b & c) | (~b & d))) + leftRotateby(a, 5)) + e) + bufPtr[i];
		e = d;
		d = c;
		c = leftRotateby(b, 30);
		b = a;
		a = tmp;
	}
	for (i = 20; i <= 39; i++) {
		tmp = (((1859775393 + ((b ^ c) ^ d)) + leftRotateby(a, 5)) + e) + bufPtr[i];
		e = d;
		d = c;
		c = leftRotateby(b, 30);
		b = a;
		a = tmp;
	}
	for (i = 40; i <= 59; i++) {
		tmp = (((2400959708 + (((b & c) | (b & d)) | (c & d))) + leftRotateby(a, 5)) + e) + bufPtr[i];
		e = d;
		d = c;
		c = leftRotateby(b, 30);
		b = a;
		a = tmp;
	}
	for (i = 60; i <= 79; i++) {
		tmp = (((3395469782 + ((b ^ c) ^ d)) + leftRotateby(a, 5)) + e) + bufPtr[i];
		e = d;
		d = c;
		c = leftRotateby(b, 30);
		b = a;
		a = tmp;
	}
	statePtr[0] = (statePtr[0] + a);
	statePtr[1] = (statePtr[1] + b);
	statePtr[2] = (statePtr[2] + c);
	statePtr[3] = (statePtr[3] + d);
	statePtr[4] = (statePtr[4] + e);
	interpreterProxy.pop(2);
}


/*	Called with one LargePositiveInteger argument. Answer the index of the top-most non-zero digit. */

function primitiveHighestNonZeroDigitIndex() {
	var arg;
	var bigIntPtr;
	var i;

	arg = interpreterProxy.stackObjectValue(0);
	interpreterProxy.success(CLASSOF(arg) === interpreterProxy.classLargePositiveInteger());
	if (interpreterProxy.failed()) {
		return null;
	}
	bigIntPtr = arg.bytes;
	i = SIZEOF(arg);
	while ((i > 0) && (bigIntPtr[(--i)] === 0)) {
	}
	interpreterProxy.pop(1);
	interpreterProxy.pushInteger(i + 1);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


/*	Multiply the divisor by the given digit (an integer in the range 0..255), shift it left by the given number of digits, and subtract the result from the current remainder. Answer true if there is an excess borrow, indicating that digit was one too large. (This case is quite rare.) */

function subtractDivisorMultipliedByDigitdigitShift(digit, digitShift) {
	var borrow;
	var i;
	var prod;
	var rIndex;
	var resultDigit;

	borrow = 0;
	rIndex = digitShift + 1;
	for (i = 1; i <= divisorDigitCount; i++) {
		prod = (dsaDivisor[i] * digit) + borrow;
		borrow = prod >>> 8;
		resultDigit = dsaRemainder[rIndex] - (prod & 255);
		if (resultDigit < 0) {

			/* borrow from the next digit */

			resultDigit += 256;
			++borrow;
		}
		dsaRemainder[rIndex] = resultDigit;
		++rIndex;
	}
	if (borrow === 0) {
		return false;
	}
	resultDigit = dsaRemainder[rIndex] - borrow;
	if (resultDigit < 0) {

		/* digit was too large (this case is quite rare) */

		dsaRemainder[rIndex] = (resultDigit + 256);
		return true;
	} else {
		dsaRemainder[rIndex] = resultDigit;
		return false;
	}
}


Squeak.registerExternalModule("DSAPrims", {
	primitiveExpandBlock: primitiveExpandBlock,
	primitiveBigDivide: primitiveBigDivide,
	primitiveHasSecureHashPrimitive: primitiveHasSecureHashPrimitive,
	primitiveHashBlock: primitiveHashBlock,
	primitiveBigMultiply: primitiveBigMultiply,
	setInterpreter: setInterpreter,
	getModuleName: getModuleName,
	primitiveHighestNonZeroDigitIndex: primitiveHighestNonZeroDigitIndex,
});

}); // end of module

/***** including ../plugins/FFTPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:20 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	FFTPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.FFTPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var fftSize = 0;
var imagData = null;
var imagDataSize = 0;
var interpreterProxy = null;
var moduleName = "FFTPlugin 3 November 2014 (e)";
var nu = 0;
var permTable = null;
var permTableSize = 0;
var realData = null;
var realDataSize = 0;
var sinTable = null;
var sinTableSize = 0;



/*	Return the first indexable word of oop which is assumed to be variableWordSubclass */

function checkedFloatPtrOf(oop) {
	interpreterProxy.success(interpreterProxy.isWords(oop));
	if (interpreterProxy.failed()) {
		return 0;
	}
	return oop.wordsAsFloat32Array();
}


/*	Return the first indexable word of oop which is assumed to be variableWordSubclass */

function checkedWordPtrOf(oop) {
	interpreterProxy.success(interpreterProxy.isWords(oop));
	return oop.words;
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}

function loadFFTFrom(fftOop) {
	var oop;

	interpreterProxy.success(SIZEOF(fftOop) >= 6);
	if (interpreterProxy.failed()) {
		return false;
	}
	nu = interpreterProxy.fetchIntegerofObject(0, fftOop);
	fftSize = interpreterProxy.fetchIntegerofObject(1, fftOop);
	oop = interpreterProxy.fetchPointerofObject(2, fftOop);
	sinTableSize = SIZEOF(oop);
	sinTable = checkedFloatPtrOf(oop);
	oop = interpreterProxy.fetchPointerofObject(3, fftOop);
	permTableSize = SIZEOF(oop);
	permTable = checkedWordPtrOf(oop);
	oop = interpreterProxy.fetchPointerofObject(4, fftOop);
	realDataSize = SIZEOF(oop);
	realData = checkedFloatPtrOf(oop);
	oop = interpreterProxy.fetchPointerofObject(5, fftOop);
	imagDataSize = SIZEOF(oop);

	/* Check assumptions about sizes */

	imagData = checkedFloatPtrOf(oop);
	interpreterProxy.success((((((SHL(1, nu)) === fftSize) && (((fftSize >> 2) + 1) === sinTableSize)) && (fftSize === realDataSize)) && (fftSize === imagDataSize)) && (realDataSize === imagDataSize));
	return interpreterProxy.failed() === false;
}

function permuteData() {
	var a;
	var b;
	var end;
	var i;
	var tmp;

	i = 0;
	end = permTableSize;
	while (i < end) {
		a = permTable[i] - 1;
		b = permTable[i + 1] - 1;
		if (!((a < realDataSize) && (b < realDataSize))) {
			return interpreterProxy.success(false);
		}
		tmp = realData[a];
		realData[a] = realData[b];
		realData[b] = tmp;
		tmp = imagData[a];
		imagData[a] = imagData[b];
		imagData[b] = tmp;
		i += 2;
	}
}

function primitiveFFTPermuteData() {
	var rcvr;

	rcvr = interpreterProxy.stackObjectValue(0);
	if (!loadFFTFrom(rcvr)) {
		return null;
	}
	permuteData();
	if (interpreterProxy.failed()) {

		/* permuteData went wrong. Do the permutation again -- this will restore the original order */

		permuteData();
	}
}

function primitiveFFTScaleData() {
	var rcvr;

	rcvr = interpreterProxy.stackObjectValue(0);
	if (!loadFFTFrom(rcvr)) {
		return null;
	}
	scaleData();
}

function primitiveFFTTransformData() {
	var forward;
	var rcvr;

	forward = interpreterProxy.booleanValueOf(interpreterProxy.stackValue(0));
	rcvr = interpreterProxy.stackObjectValue(1);
	if (!loadFFTFrom(rcvr)) {
		return null;
	}
	transformData(forward);
	if (!interpreterProxy.failed()) {
		interpreterProxy.pop(1);
	}
}


/*	Scale all elements by 1/n when doing inverse */

function scaleData() {
	var i;
	var realN;

	if (fftSize <= 1) {
		return null;
	}
	realN = (1.0 / fftSize);
	for (i = 0; i <= (fftSize - 1); i++) {
		realData[i] = (realData[i] * realN);
		imagData[i] = (imagData[i] * realN);
	}
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}

function transformData(forward) {
	permuteData();
	if (interpreterProxy.failed()) {

		/* permuteData went wrong. Do the permutation again -- this will restore the original order */

		permuteData();
		return null;
	}
	transformForward(forward);
	if (!forward) {
		scaleData();
	}
}

function transformForward(forward) {
	var fftScale;
	var fftSize2;
	var fftSize4;
	var i;
	var ii;
	var imagT;
	var imagU;
	var ip;
	var j;
	var lev;
	var lev1;
	var level;
	var realT;
	var realU;
	var theta;

	fftSize2 = fftSize >> 1;
	fftSize4 = fftSize >> 2;
	for (level = 1; level <= nu; level++) {
		lev = SHL(1, level);
		lev1 = lev >> 1;
		fftScale = DIV(fftSize, lev);
		for (j = 1; j <= lev1; j++) {

			/* pi * (j-1) / lev1 mapped onto 0..n/2 */

			theta = (j - 1) * fftScale;
			if (theta < fftSize4) {

				/* Compute U, the complex multiplier for each level */

				realU = sinTable[(sinTableSize - theta) - 1];
				imagU = sinTable[theta];
			} else {
				realU = 0.0 - sinTable[theta - fftSize4];
				imagU = sinTable[fftSize2 - theta];
			}
			if (!forward) {
				imagU = 0.0 - imagU;
			}
			i = j;
			while (i <= fftSize) {
				ip = (i + lev1) - 1;
				ii = i - 1;
				realT = (realData[ip] * realU) - (imagData[ip] * imagU);
				imagT = (realData[ip] * imagU) + (imagData[ip] * realU);
				realData[ip] = (realData[ii] - realT);
				imagData[ip] = (imagData[ii] - imagT);
				realData[ii] = (realData[ii] + realT);
				imagData[ii] = (imagData[ii] + imagT);
				i += lev;
			}
		}
	}
}


Squeak.registerExternalModule("FFTPlugin", {
	primitiveFFTTransformData: primitiveFFTTransformData,
	setInterpreter: setInterpreter,
	primitiveFFTPermuteData: primitiveFFTPermuteData,
	primitiveFFTScaleData: primitiveFFTScaleData,
	getModuleName: getModuleName,
});

}); // end of module

/***** including ../plugins/FloatArrayPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:20 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	FloatArrayPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.FloatArrayPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var interpreterProxy = null;
var moduleName = "FloatArrayPlugin 3 November 2014 (e)";



/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}


/*	Primitive. Add the receiver and the argument, both FloatArrays and store the result into the receiver. */

function primitiveAddFloatArray() {
	var arg;
	var argPtr;
	var i;
	var length;
	var rcvr;
	var rcvrPtr;

	arg = interpreterProxy.stackObjectValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(arg));
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(arg);
	interpreterProxy.success(length === SIZEOF(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	rcvrPtr = rcvr.wordsAsFloat32Array();
	argPtr = arg.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] + argPtr[i]);
	}
	interpreterProxy.pop(1);
}


/*	Primitive. Add the argument, a scalar value to the receiver, a FloatArray */

function primitiveAddScalar() {
	var i;
	var length;
	var rcvr;
	var rcvrPtr;
	var value;

	value = interpreterProxy.stackFloatValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	rcvrPtr = rcvr.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] + value);
	}
	interpreterProxy.pop(1);
}

function primitiveAt() {
	var floatPtr;
	var floatValue;
	var index;
	var rcvr;

	index = interpreterProxy.stackIntegerValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	interpreterProxy.success((index > 0) && (index <= SIZEOF(rcvr)));
	if (interpreterProxy.failed()) {
		return null;
	}
	floatPtr = rcvr.wordsAsFloat32Array();
	floatValue = floatPtr[index - 1];
	interpreterProxy.pop(2);
	interpreterProxy.pushFloat(floatValue);
}

function primitiveAtPut() {
	var floatPtr;
	var floatValue;
	var index;
	var rcvr;
	var value;

	value = interpreterProxy.stackValue(0);
	if (typeof value === "number") {
		floatValue = value;
	} else {
		floatValue = interpreterProxy.floatValueOf(value);
	}
	index = interpreterProxy.stackIntegerValue(1);
	rcvr = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	interpreterProxy.success((index > 0) && (index <= SIZEOF(rcvr)));
	if (interpreterProxy.failed()) {
		return null;
	}
	floatPtr = rcvr.wordsAsFloat32Array();
	floatPtr[index - 1] = floatValue;
	if (!interpreterProxy.failed()) {
		interpreterProxy.popthenPush(3, value);
	}
}


/*	Primitive. Add the receiver and the argument, both FloatArrays and store the result into the receiver. */

function primitiveDivFloatArray() {
	var arg;
	var argPtr;
	var i;
	var length;
	var rcvr;
	var rcvrPtr;

	arg = interpreterProxy.stackObjectValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(arg));
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(arg);
	interpreterProxy.success(length === SIZEOF(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	rcvrPtr = rcvr.wordsAsFloat32Array();

	/* Check if any of the argument's values is zero */

	argPtr = arg.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		if (argPtr[i] === 0) {
			return interpreterProxy.primitiveFail();
		}
	}
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] / argPtr[i]);
	}
	interpreterProxy.pop(1);
}


/*	Primitive. Add the argument, a scalar value to the receiver, a FloatArray */

function primitiveDivScalar() {
	var i;
	var inverse;
	var length;
	var rcvr;
	var rcvrPtr;
	var value;

	value = interpreterProxy.stackFloatValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (value === 0.0) {
		return interpreterProxy.primitiveFail();
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	rcvrPtr = rcvr.wordsAsFloat32Array();
	inverse = 1.0 / value;
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] * inverse);
	}
	interpreterProxy.pop(1);
}


/*	Primitive. Compute the dot product of the receiver and the argument.
	The dot product is defined as the sum of the products of the individual elements. */

function primitiveDotProduct() {
	var arg;
	var argPtr;
	var i;
	var length;
	var rcvr;
	var rcvrPtr;
	var result;

	arg = interpreterProxy.stackObjectValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(arg));
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(arg);
	interpreterProxy.success(length === SIZEOF(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	rcvrPtr = rcvr.wordsAsFloat32Array();
	argPtr = arg.wordsAsFloat32Array();
	result = 0.0;
	for (i = 0; i <= (length - 1); i++) {
		result += rcvrPtr[i] * argPtr[i];
	}
	interpreterProxy.pop(2);
	interpreterProxy.pushFloat(result);
}

function primitiveEqual() {
	var arg;
	var argPtr;
	var i;
	var length;
	var rcvr;
	var rcvrPtr;

	arg = interpreterProxy.stackObjectValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(arg));
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(2);
	length = SIZEOF(arg);
	if (length !== SIZEOF(rcvr)) {
		return interpreterProxy.pushBool(false);
	}
	rcvrPtr = rcvr.wordsAsFloat32Array();
	argPtr = arg.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		if (rcvrPtr[i] !== argPtr[i]) {
			return interpreterProxy.pushBool(false);
		}
	}
	return interpreterProxy.pushBool(true);
}

function primitiveHashArray() {
	var i;
	var length;
	var rcvr;
	var rcvrPtr;
	var result;

	rcvr = interpreterProxy.stackObjectValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	rcvrPtr = rcvr.wordsAsInt32Array();
	result = 0;
	for (i = 0; i <= (length - 1); i++) {
		result += rcvrPtr[i];
	}
	interpreterProxy.pop(1);
	return interpreterProxy.pushInteger(result & 536870911);
}


/*	Primitive. Compute the length of the argument (sqrt of sum of component squares). */

function primitiveLength() {
	var i;
	var length;
	var rcvr;
	var rcvrPtr;
	var result;

	rcvr = interpreterProxy.stackObjectValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	interpreterProxy.success(true);
	rcvrPtr = rcvr.wordsAsFloat32Array();
	result = 0.0;
	for (i = 0; i <= (length - 1); i++) {
		result += rcvrPtr[i] * rcvrPtr[i];
	}
	result = Math.sqrt(result);
	interpreterProxy.popthenPush(1, interpreterProxy.floatObjectOf(result));
}


/*	Primitive. Add the receiver and the argument, both FloatArrays and store the result into the receiver. */

function primitiveMulFloatArray() {
	var arg;
	var argPtr;
	var i;
	var length;
	var rcvr;
	var rcvrPtr;

	arg = interpreterProxy.stackObjectValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(arg));
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(arg);
	interpreterProxy.success(length === SIZEOF(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	rcvrPtr = rcvr.wordsAsFloat32Array();
	argPtr = arg.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] * argPtr[i]);
	}
	interpreterProxy.pop(1);
}


/*	Primitive. Add the argument, a scalar value to the receiver, a FloatArray */

function primitiveMulScalar() {
	var i;
	var length;
	var rcvr;
	var rcvrPtr;
	var value;

	value = interpreterProxy.stackFloatValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	rcvrPtr = rcvr.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] * value);
	}
	interpreterProxy.pop(1);
}


/*	Primitive. Normalize the argument (A FloatArray) in place. */

function primitiveNormalize() {
	var i;
	var len;
	var length;
	var rcvr;
	var rcvrPtr;

	rcvr = interpreterProxy.stackObjectValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	interpreterProxy.success(true);
	rcvrPtr = rcvr.wordsAsFloat32Array();
	len = 0.0;
	for (i = 0; i <= (length - 1); i++) {
		len += rcvrPtr[i] * rcvrPtr[i];
	}
	interpreterProxy.success(len > 0.0);
	if (interpreterProxy.failed()) {
		return null;
	}
	len = Math.sqrt(len);
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] / len);
	}
}


/*	Primitive. Add the receiver and the argument, both FloatArrays and store the result into the receiver. */

function primitiveSubFloatArray() {
	var arg;
	var argPtr;
	var i;
	var length;
	var rcvr;
	var rcvrPtr;

	arg = interpreterProxy.stackObjectValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(arg));
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(arg);
	interpreterProxy.success(length === SIZEOF(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	rcvrPtr = rcvr.wordsAsFloat32Array();
	argPtr = arg.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] - argPtr[i]);
	}
	interpreterProxy.pop(1);
}


/*	Primitive. Add the argument, a scalar value to the receiver, a FloatArray */

function primitiveSubScalar() {
	var i;
	var length;
	var rcvr;
	var rcvrPtr;
	var value;

	value = interpreterProxy.stackFloatValue(0);
	rcvr = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	rcvrPtr = rcvr.wordsAsFloat32Array();
	for (i = 0; i <= (length - 1); i++) {
		rcvrPtr[i] = (rcvrPtr[i] - value);
	}
	interpreterProxy.pop(1);
}


/*	Primitive. Find the sum of each float in the receiver, a FloatArray, and stash the result into the argument Float. */

function primitiveSum() {
	var i;
	var length;
	var rcvr;
	var rcvrPtr;
	var sum;

	rcvr = interpreterProxy.stackObjectValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvr));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvr);
	rcvrPtr = rcvr.wordsAsFloat32Array();
	sum = 0.0;
	for (i = 0; i <= (length - 1); i++) {
		sum += rcvrPtr[i];
	}
	interpreterProxy.popthenPush(1, interpreterProxy.floatObjectOf(sum));
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


Squeak.registerExternalModule("FloatArrayPlugin", {
	primitiveMulFloatArray: primitiveMulFloatArray,
	primitiveEqual: primitiveEqual,
	primitiveAtPut: primitiveAtPut,
	primitiveAt: primitiveAt,
	primitiveNormalize: primitiveNormalize,
	primitiveSubFloatArray: primitiveSubFloatArray,
	primitiveDivFloatArray: primitiveDivFloatArray,
	primitiveAddScalar: primitiveAddScalar,
	primitiveDotProduct: primitiveDotProduct,
	primitiveSubScalar: primitiveSubScalar,
	setInterpreter: setInterpreter,
	primitiveSum: primitiveSum,
	getModuleName: getModuleName,
	primitiveHashArray: primitiveHashArray,
	primitiveMulScalar: primitiveMulScalar,
	primitiveLength: primitiveLength,
	primitiveAddFloatArray: primitiveAddFloatArray,
	primitiveDivScalar: primitiveDivScalar,
});

}); // end of module

/***** including ../plugins/JPEGReaderPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:20 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	JPEGReaderPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.JPEGReaderPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Constants ***/
var BlockWidthIndex = 5;
var BlueIndex = 2;
var ConstBits = 13;
var CurrentXIndex = 0;
var CurrentYIndex = 1;
var DCTSize = 8;
var DCTSize2 = 64;
var FIXn0n298631336 = 2446;
var FIXn0n34414 = 22554;
var FIXn0n390180644 = 3196;
var FIXn0n541196100 = 4433;
var FIXn0n71414 = 46802;
var FIXn0n765366865 = 6270;
var FIXn0n899976223 = 7373;
var FIXn1n175875602 = 9633;
var FIXn1n40200 = 91881;
var FIXn1n501321110 = 12299;
var FIXn1n77200 = 116130;
var FIXn1n847759065 = 15137;
var FIXn1n961570560 = 16069;
var FIXn2n053119869 = 16819;
var FIXn2n562915447 = 20995;
var FIXn3n072711026 = 25172;
var GreenIndex = 1;
var HScaleIndex = 2;
var MCUBlockIndex = 4;
var MCUWidthIndex = 8;
var MaxBits = 16;
var MaxMCUBlocks = 128;
var MaxSample = 255;
var MinComponentSize = 11;
var Pass1Bits = 2;
var Pass1Div = 2048;
var Pass2Div = 262144;
var PriorDCValueIndex = 10;
var RedIndex = 0;
var SampleOffset = 127;
var VScaleIndex = 3;

/*** Variables ***/
var acTable = null;
var acTableSize = 0;
var cbBlocks = new Array(128);
var cbComponent = new Array(11);
var cbSampleStream = 0;
var crBlocks = new Array(128);
var crComponent = new Array(11);
var crSampleStream = 0;
var dcTable = null;
var dcTableSize = 0;
var ditherMask = 0;
var interpreterProxy = null;
var jpegBits = null;
var jpegBitsSize = 0;
var jpegNaturalOrder = [
	0, 1, 8, 16, 9, 2, 3, 10, 
	17, 24, 32, 25, 18, 11, 4, 5, 
	12, 19, 26, 33, 40, 48, 41, 34, 
	27, 20, 13, 6, 7, 14, 21, 28, 
	35, 42, 49, 56, 57, 50, 43, 36, 
	29, 22, 15, 23, 30, 37, 44, 51, 
	58, 59, 52, 45, 38, 31, 39, 46, 
	53, 60, 61, 54, 47, 55, 62, 63
];
var jsBitBuffer = 0;
var jsBitCount = 0;
var jsCollection = null;
var jsPosition = 0;
var jsReadLimit = 0;
var moduleName = "JPEGReaderPlugin 3 November 2014 (e)";
var residuals = null;
var yBlocks = new Array(128);
var yComponent = new Array(11);
var ySampleStream = 0;


function cbColorComponentFrom(oop) {
	return colorComponentfrom(cbComponent, oop) && (colorComponentBlocksfrom(cbBlocks, oop));
}

function colorComponentfrom(aColorComponent, oop) {
	if (typeof oop === "number") {
		return false;
	}
	if (!interpreterProxy.isPointers(oop)) {
		return false;
	}
	if (SIZEOF(oop) < MinComponentSize) {
		return false;
	}
	aColorComponent[CurrentXIndex] = interpreterProxy.fetchIntegerofObject(CurrentXIndex, oop);
	aColorComponent[CurrentYIndex] = interpreterProxy.fetchIntegerofObject(CurrentYIndex, oop);
	aColorComponent[HScaleIndex] = interpreterProxy.fetchIntegerofObject(HScaleIndex, oop);
	aColorComponent[VScaleIndex] = interpreterProxy.fetchIntegerofObject(VScaleIndex, oop);
	aColorComponent[BlockWidthIndex] = interpreterProxy.fetchIntegerofObject(BlockWidthIndex, oop);
	aColorComponent[MCUWidthIndex] = interpreterProxy.fetchIntegerofObject(MCUWidthIndex, oop);
	aColorComponent[PriorDCValueIndex] = interpreterProxy.fetchIntegerofObject(PriorDCValueIndex, oop);
	return !interpreterProxy.failed();
}

function colorComponentBlocksfrom(blocks, oop) {
	var arrayOop;
	var blockOop;
	var i;
	var max;

	if (typeof oop === "number") {
		return false;
	}
	if (!interpreterProxy.isPointers(oop)) {
		return false;
	}
	if (SIZEOF(oop) < MinComponentSize) {
		return false;
	}
	arrayOop = interpreterProxy.fetchPointerofObject(MCUBlockIndex, oop);
	if (typeof arrayOop === "number") {
		return false;
	}
	if (!interpreterProxy.isPointers(arrayOop)) {
		return false;
	}
	max = SIZEOF(arrayOop);
	if (max > MaxMCUBlocks) {
		return false;
	}
	for (i = 0; i <= (max - 1); i++) {
		blockOop = interpreterProxy.fetchPointerofObject(i, arrayOop);
		if (typeof blockOop === "number") {
			return false;
		}
		if (!interpreterProxy.isWords(blockOop)) {
			return false;
		}
		if (SIZEOF(blockOop) !== DCTSize2) {
			return false;
		}
		blocks[i] = blockOop.wordsAsInt32Array();
	}
	return !interpreterProxy.failed();
}

function colorConvertGrayscaleMCU() {
	var i;
	var y;

	yComponent[CurrentXIndex] = 0;
	yComponent[CurrentYIndex] = 0;
	for (i = 0; i <= (jpegBitsSize - 1); i++) {
		y = nextSampleY();
		y += residuals[GreenIndex];
		y = Math.min(y, MaxSample);
		residuals[GreenIndex] = (y & ditherMask);
		y = y & (MaxSample - ditherMask);
		y = Math.max(y, 1);
		jpegBits[i] = (((4278190080 + (y << 16)) + (y << 8)) + y);
	}
}

function colorConvertMCU() {
	var blue;
	var cb;
	var cr;
	var green;
	var i;
	var red;
	var y;

	yComponent[CurrentXIndex] = 0;
	yComponent[CurrentYIndex] = 0;
	cbComponent[CurrentXIndex] = 0;
	cbComponent[CurrentYIndex] = 0;
	crComponent[CurrentXIndex] = 0;
	crComponent[CurrentYIndex] = 0;
	for (i = 0; i <= (jpegBitsSize - 1); i++) {
		y = nextSampleY();
		cb = nextSampleCb();
		cb -= SampleOffset;
		cr = nextSampleCr();
		cr -= SampleOffset;
		red = (y + ((FIXn1n40200 * cr) >> 16)) + residuals[RedIndex];
		red = Math.min(red, MaxSample);
		red = Math.max(red, 0);
		residuals[RedIndex] = (red & ditherMask);
		red = red & (MaxSample - ditherMask);
		red = Math.max(red, 1);
		green = ((y - ((FIXn0n34414 * cb) >> 16)) - ((FIXn0n71414 * cr) >> 16)) + residuals[GreenIndex];
		green = Math.min(green, MaxSample);
		green = Math.max(green, 0);
		residuals[GreenIndex] = (green & ditherMask);
		green = green & (MaxSample - ditherMask);
		green = Math.max(green, 1);
		blue = (y + ((FIXn1n77200 * cb) >> 16)) + residuals[BlueIndex];
		blue = Math.min(blue, MaxSample);
		blue = Math.max(blue, 0);
		residuals[BlueIndex] = (blue & ditherMask);
		blue = blue & (MaxSample - ditherMask);
		blue = Math.max(blue, 1);
		jpegBits[i] = (((4278190080 + (red << 16)) + (green << 8)) + blue);
	}
}

function crColorComponentFrom(oop) {
	return colorComponentfrom(crComponent, oop) && (colorComponentBlocksfrom(crBlocks, oop));
}

function decodeBlockIntocomponent(anArray, aColorComponent) {
	var bits;
	var byte;
	var i;
	var index;
	var zeroCount;

	byte = jpegDecodeValueFromsize(dcTable, dcTableSize);
	if (byte < 0) {
		return interpreterProxy.primitiveFail();
	}
	if (byte !== 0) {
		bits = getBits(byte);
		byte = scaleAndSignExtendinFieldWidth(bits, byte);
	}
	byte = aColorComponent[PriorDCValueIndex] = (aColorComponent[PriorDCValueIndex] + byte);
	anArray[0] = byte;
	for (i = 1; i <= (DCTSize2 - 1); i++) {
		anArray[i] = 0;
	}
	index = 1;
	while (index < DCTSize2) {
		byte = jpegDecodeValueFromsize(acTable, acTableSize);
		if (byte < 0) {
			return interpreterProxy.primitiveFail();
		}
		zeroCount = byte >>> 4;
		byte = byte & 15;
		if (byte !== 0) {
			index += zeroCount;
			bits = getBits(byte);
			byte = scaleAndSignExtendinFieldWidth(bits, byte);
			if ((index < 0) || (index >= DCTSize2)) {
				return interpreterProxy.primitiveFail();
			}
			anArray[jpegNaturalOrder[index]] = byte;
		} else {
			if (zeroCount === 15) {
				index += zeroCount;
			} else {
				return null;
			}
		}
		++index;
	}
}

function fillBuffer() {
	var byte;

	while (jsBitCount <= 16) {
		if (!(jsPosition < jsReadLimit)) {
			return jsBitCount;
		}
		byte = jsCollection[jsPosition];
		++jsPosition;
		if (byte === 255) {

			/* peek for 00 */

			if (!((jsPosition < jsReadLimit) && (jsCollection[jsPosition] === 0))) {
				--jsPosition;
				return jsBitCount;
			}
			++jsPosition;
		}
		jsBitBuffer = (jsBitBuffer << 8) | byte;
		jsBitCount += 8;
	}
	return jsBitCount;
}

function getBits(requestedBits) {
	var value;

	if (requestedBits > jsBitCount) {
		fillBuffer();
		if (requestedBits > jsBitCount) {
			return -1;
		}
	}
	jsBitCount -= requestedBits;
	value = SHR(jsBitBuffer, jsBitCount);
	jsBitBuffer = jsBitBuffer & ((SHL(1, jsBitCount)) - 1);
	return value;
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}

function idctBlockIntqt(anArray, qt) {
	var anACTerm;
	var dcval;
	var i;
	var j;
	var row;
	var t0;
	var t1;
	var t10;
	var t11;
	var t12;
	var t13;
	var t2;
	var t3;
	var v;
	var ws = new Array(64);
	var z1;
	var z2;
	var z3;
	var z4;
	var z5;

	;
	for (i = 0; i <= (DCTSize - 1); i++) {
		anACTerm = -1;
		for (row = 1; row <= (DCTSize - 1); row++) {
			if (anACTerm === -1) {
				if (anArray[(row * DCTSize) + i] !== 0) {
					anACTerm = row;
				}
			}
		}
		if (anACTerm === -1) {
			dcval = (anArray[i] * qt[0]) << 2;
			for (j = 0; j <= (DCTSize - 1); j++) {
				ws[(j * DCTSize) + i] = dcval;
			}
		} else {
			z2 = anArray[(DCTSize * 2) + i] * qt[(DCTSize * 2) + i];
			z3 = anArray[(DCTSize * 6) + i] * qt[(DCTSize * 6) + i];
			z1 = (z2 + z3) * FIXn0n541196100;
			t2 = z1 + (z3 * (0 - FIXn1n847759065));
			t3 = z1 + (z2 * FIXn0n765366865);
			z2 = anArray[i] * qt[i];
			z3 = anArray[(DCTSize * 4) + i] * qt[(DCTSize * 4) + i];
			t0 = (z2 + z3) << 13;
			t1 = (z2 - z3) << 13;
			t10 = t0 + t3;
			t13 = t0 - t3;
			t11 = t1 + t2;
			t12 = t1 - t2;
			t0 = anArray[(DCTSize * 7) + i] * qt[(DCTSize * 7) + i];
			t1 = anArray[(DCTSize * 5) + i] * qt[(DCTSize * 5) + i];
			t2 = anArray[(DCTSize * 3) + i] * qt[(DCTSize * 3) + i];
			t3 = anArray[DCTSize + i] * qt[DCTSize + i];
			z1 = t0 + t3;
			z2 = t1 + t2;
			z3 = t0 + t2;
			z4 = t1 + t3;
			z5 = (z3 + z4) * FIXn1n175875602;
			t0 = t0 * FIXn0n298631336;
			t1 = t1 * FIXn2n053119869;
			t2 = t2 * FIXn3n072711026;
			t3 = t3 * FIXn1n501321110;
			z1 = z1 * (0 - FIXn0n899976223);
			z2 = z2 * (0 - FIXn2n562915447);
			z3 = z3 * (0 - FIXn1n961570560);
			z4 = z4 * (0 - FIXn0n390180644);
			z3 += z5;
			z4 += z5;
			t0 = (t0 + z1) + z3;
			t1 = (t1 + z2) + z4;
			t2 = (t2 + z2) + z3;
			t3 = (t3 + z1) + z4;
			ws[i] = ((t10 + t3) >> 11);
			ws[(DCTSize * 7) + i] = ((t10 - t3) >> 11);
			ws[(DCTSize * 1) + i] = ((t11 + t2) >> 11);
			ws[(DCTSize * 6) + i] = ((t11 - t2) >> 11);
			ws[(DCTSize * 2) + i] = ((t12 + t1) >> 11);
			ws[(DCTSize * 5) + i] = ((t12 - t1) >> 11);
			ws[(DCTSize * 3) + i] = ((t13 + t0) >> 11);
			ws[(DCTSize * 4) + i] = ((t13 - t0) >> 11);
		}
	}
	for (i = 0; i <= (DCTSize2 - DCTSize); i += DCTSize) {
		z2 = ws[i + 2];
		z3 = ws[i + 6];
		z1 = (z2 + z3) * FIXn0n541196100;
		t2 = z1 + (z3 * (0 - FIXn1n847759065));
		t3 = z1 + (z2 * FIXn0n765366865);
		t0 = (ws[i] + ws[i + 4]) << 13;
		t1 = (ws[i] - ws[i + 4]) << 13;
		t10 = t0 + t3;
		t13 = t0 - t3;
		t11 = t1 + t2;
		t12 = t1 - t2;
		t0 = ws[i + 7];
		t1 = ws[i + 5];
		t2 = ws[i + 3];
		t3 = ws[i + 1];
		z1 = t0 + t3;
		z2 = t1 + t2;
		z3 = t0 + t2;
		z4 = t1 + t3;
		z5 = (z3 + z4) * FIXn1n175875602;
		t0 = t0 * FIXn0n298631336;
		t1 = t1 * FIXn2n053119869;
		t2 = t2 * FIXn3n072711026;
		t3 = t3 * FIXn1n501321110;
		z1 = z1 * (0 - FIXn0n899976223);
		z2 = z2 * (0 - FIXn2n562915447);
		z3 = z3 * (0 - FIXn1n961570560);
		z4 = z4 * (0 - FIXn0n390180644);
		z3 += z5;
		z4 += z5;
		t0 = (t0 + z1) + z3;
		t1 = (t1 + z2) + z4;
		t2 = (t2 + z2) + z3;
		t3 = (t3 + z1) + z4;
		v = ((t10 + t3) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i] = v;
		v = ((t10 - t3) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i + 7] = v;
		v = ((t11 + t2) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i + 1] = v;
		v = ((t11 - t2) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i + 6] = v;
		v = ((t12 + t1) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i + 2] = v;
		v = ((t12 - t1) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i + 5] = v;
		v = ((t13 + t0) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i + 3] = v;
		v = ((t13 - t0) >> 18) + SampleOffset;
		v = Math.min(v, MaxSample);
		v = Math.max(v, 0);
		anArray[i + 4] = v;
	}
}


/*	Decode the next value in the receiver using the given huffman table. */

function jpegDecodeValueFromsize(table, tableSize) {
	var bits;
	var bitsNeeded;
	var index;
	var tableIndex;
	var value;


	/* Initial bits needed */

	bitsNeeded = table[0] >>> 24;
	if (bitsNeeded > MaxBits) {
		return -1;
	}

	/* First real table */

	tableIndex = 2;
	while (true) {

		/* Get bits */

		bits = getBits(bitsNeeded);
		if (bits < 0) {
			return -1;
		}
		index = (tableIndex + bits) - 1;
		if (index >= tableSize) {
			return -1;
		}

		/* Lookup entry in table */

		value = table[index];
		if ((value & 1056964608) === 0) {
			return value;
		}

		/* Table offset in low 16 bit */

		tableIndex = value & 65535;

		/* Additional bits in high 8 bit */

		bitsNeeded = (value >>> 24) & 255;
		if (bitsNeeded > MaxBits) {
			return -1;
		}
	}
	return -1;
}

function loadJPEGStreamFrom(streamOop) {
	var oop;
	var sz;

	if (SIZEOF(streamOop) < 5) {
		return false;
	}
	if (!interpreterProxy.isPointers(streamOop)) {
		return false;
	}
	oop = interpreterProxy.fetchPointerofObject(0, streamOop);
	if (typeof oop === "number") {
		return false;
	}
	if (!interpreterProxy.isBytes(oop)) {
		return false;
	}
	jsCollection = oop.bytes;
	sz = BYTESIZEOF(oop);
	jsPosition = interpreterProxy.fetchIntegerofObject(1, streamOop);
	jsReadLimit = interpreterProxy.fetchIntegerofObject(2, streamOop);
	jsBitBuffer = interpreterProxy.fetchIntegerofObject(3, streamOop);
	jsBitCount = interpreterProxy.fetchIntegerofObject(4, streamOop);
	if (interpreterProxy.failed()) {
		return false;
	}
	if (sz < jsReadLimit) {
		return false;
	}
	if ((jsPosition < 0) || (jsPosition >= jsReadLimit)) {
		return false;
	}
	return true;
}

function nextSampleCb() {
	var blockIndex;
	var curX;
	var dx;
	var dy;
	var sample;
	var sampleIndex;
	var sx;
	var sy;

	dx = (curX = cbComponent[CurrentXIndex]);
	dy = cbComponent[CurrentYIndex];
	sx = cbComponent[HScaleIndex];
	sy = cbComponent[VScaleIndex];
	if ((sx !== 0) && (sy !== 0)) {
		dx = DIV(dx, sx);
		dy = DIV(dy, sy);
	}
	blockIndex = ((dy >>> 3) * cbComponent[BlockWidthIndex]) + (dx >>> 3);
	sampleIndex = ((dy & 7) << 3) + (dx & 7);
	sample = cbBlocks[blockIndex][sampleIndex];
	++curX;
	if (curX < (cbComponent[MCUWidthIndex] * 8)) {
		cbComponent[CurrentXIndex] = curX;
	} else {
		cbComponent[CurrentXIndex] = 0;
		cbComponent[CurrentYIndex]++;
	}
	return sample;
}

function nextSampleCr() {
	var blockIndex;
	var curX;
	var dx;
	var dy;
	var sample;
	var sampleIndex;
	var sx;
	var sy;

	dx = (curX = crComponent[CurrentXIndex]);
	dy = crComponent[CurrentYIndex];
	sx = crComponent[HScaleIndex];
	sy = crComponent[VScaleIndex];
	if ((sx !== 0) && (sy !== 0)) {
		dx = DIV(dx, sx);
		dy = DIV(dy, sy);
	}
	blockIndex = ((dy >>> 3) * crComponent[BlockWidthIndex]) + (dx >>> 3);
	sampleIndex = ((dy & 7) << 3) + (dx & 7);
	sample = crBlocks[blockIndex][sampleIndex];
	++curX;
	if (curX < (crComponent[MCUWidthIndex] * 8)) {
		crComponent[CurrentXIndex] = curX;
	} else {
		crComponent[CurrentXIndex] = 0;
		crComponent[CurrentYIndex]++;
	}
	return sample;
}

function nextSampleY() {
	var blockIndex;
	var curX;
	var dx;
	var dy;
	var sample;
	var sampleIndex;
	var sx;
	var sy;

	dx = (curX = yComponent[CurrentXIndex]);
	dy = yComponent[CurrentYIndex];
	sx = yComponent[HScaleIndex];
	sy = yComponent[VScaleIndex];
	if ((sx !== 0) && (sy !== 0)) {
		dx = DIV(dx, sx);
		dy = DIV(dy, sy);
	}
	blockIndex = ((dy >>> 3) * yComponent[BlockWidthIndex]) + (dx >>> 3);
	sampleIndex = ((dy & 7) << 3) + (dx & 7);
	sample = yBlocks[blockIndex][sampleIndex];
	++curX;
	if (curX < (yComponent[MCUWidthIndex] * 8)) {
		yComponent[CurrentXIndex] = curX;
	} else {
		yComponent[CurrentXIndex] = 0;
		yComponent[CurrentYIndex]++;
	}
	return sample;
}


/*	Requires:
		JPEGColorComponent
		bits
		WordArray with: 3*Integer (residuals)
		ditherMask
	 */

function primitiveColorConvertGrayscaleMCU() {
	var arrayOop;

	stInit();
	if (interpreterProxy.methodArgumentCount() !== 4) {
		return interpreterProxy.primitiveFail();
	}
	ditherMask = interpreterProxy.stackIntegerValue(0);
	arrayOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!(interpreterProxy.isWords(arrayOop) && (SIZEOF(arrayOop) === 3))) {
		return interpreterProxy.primitiveFail();
	}
	residuals = arrayOop.wordsAsInt32Array();
	arrayOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(arrayOop)) {
		return interpreterProxy.primitiveFail();
	}
	jpegBitsSize = SIZEOF(arrayOop);
	jpegBits = arrayOop.wordsAsInt32Array();
	arrayOop = interpreterProxy.stackObjectValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!yColorComponentFrom(arrayOop)) {
		return interpreterProxy.primitiveFail();
	}
	colorConvertGrayscaleMCU();
	interpreterProxy.pop(4);
}


/*	Requires:
		Array with: 3*JPEGColorComponent
		bits
		WordArray with: 3*Integer (residuals)
		ditherMask
	 */

function primitiveColorConvertMCU() {
	var arrayOop;

	stInit();
	if (interpreterProxy.methodArgumentCount() !== 4) {
		return interpreterProxy.primitiveFail();
	}
	ditherMask = interpreterProxy.stackIntegerValue(0);
	arrayOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!(interpreterProxy.isWords(arrayOop) && (SIZEOF(arrayOop) === 3))) {
		return interpreterProxy.primitiveFail();
	}
	residuals = arrayOop.wordsAsInt32Array();
	arrayOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(arrayOop)) {
		return interpreterProxy.primitiveFail();
	}
	jpegBitsSize = SIZEOF(arrayOop);
	jpegBits = arrayOop.wordsAsInt32Array();
	arrayOop = interpreterProxy.stackObjectValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!(interpreterProxy.isPointers(arrayOop) && (SIZEOF(arrayOop) === 3))) {
		return interpreterProxy.primitiveFail();
	}
	if (!yColorComponentFrom(interpreterProxy.fetchPointerofObject(0, arrayOop))) {
		return interpreterProxy.primitiveFail();
	}
	if (!cbColorComponentFrom(interpreterProxy.fetchPointerofObject(1, arrayOop))) {
		return interpreterProxy.primitiveFail();
	}
	if (!crColorComponentFrom(interpreterProxy.fetchPointerofObject(2, arrayOop))) {
		return interpreterProxy.primitiveFail();
	}
	colorConvertMCU();
	interpreterProxy.pop(4);
}


/*	In:
		anArray 		WordArray of: DCTSize2
		aColorComponent JPEGColorComponent
		dcTable			WordArray
		acTable			WordArray
		stream			JPEGStream
	 */

function primitiveDecodeMCU() {
	var anArray;
	var arrayOop;
	var oop;

	;
	if (interpreterProxy.methodArgumentCount() !== 5) {
		return interpreterProxy.primitiveFail();
	}
	oop = interpreterProxy.stackObjectValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!loadJPEGStreamFrom(oop)) {
		return interpreterProxy.primitiveFail();
	}
	arrayOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(arrayOop)) {
		return interpreterProxy.primitiveFail();
	}
	acTableSize = SIZEOF(arrayOop);
	acTable = arrayOop.wordsAsInt32Array();
	arrayOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(arrayOop)) {
		return interpreterProxy.primitiveFail();
	}
	dcTableSize = SIZEOF(arrayOop);
	dcTable = arrayOop.wordsAsInt32Array();
	oop = interpreterProxy.stackObjectValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!colorComponentfrom(yComponent, oop)) {
		return interpreterProxy.primitiveFail();
	}
	arrayOop = interpreterProxy.stackObjectValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(arrayOop)) {
		return interpreterProxy.primitiveFail();
	}
	if (SIZEOF(arrayOop) !== DCTSize2) {
		return interpreterProxy.primitiveFail();
	}
	anArray = arrayOop.wordsAsInt32Array();
	if (interpreterProxy.failed()) {
		return null;
	}
	decodeBlockIntocomponent(anArray, yComponent);
	if (interpreterProxy.failed()) {
		return null;
	}
	storeJPEGStreamOn(interpreterProxy.stackValue(0));
	interpreterProxy.storeIntegerofObjectwithValue(PriorDCValueIndex, interpreterProxy.stackValue(3), yComponent[PriorDCValueIndex]);
	interpreterProxy.pop(5);
}


/*	In:
		anArray: IntegerArray new: DCTSize2
		qt: IntegerArray new: DCTSize2.
	 */

function primitiveIdctInt() {
	var anArray;
	var arrayOop;
	var qt;

	;
	if (interpreterProxy.methodArgumentCount() !== 2) {
		return interpreterProxy.primitiveFail();
	}
	arrayOop = interpreterProxy.stackObjectValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!(interpreterProxy.isWords(arrayOop) && (SIZEOF(arrayOop) === DCTSize2))) {
		return interpreterProxy.primitiveFail();
	}
	qt = arrayOop.wordsAsInt32Array();
	arrayOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!(interpreterProxy.isWords(arrayOop) && (SIZEOF(arrayOop) === DCTSize2))) {
		return interpreterProxy.primitiveFail();
	}
	anArray = arrayOop.wordsAsInt32Array();
	idctBlockIntqt(anArray, qt);
	interpreterProxy.pop(2);
}

function scaleAndSignExtendinFieldWidth(aNumber, w) {
	if (aNumber < (SHL(1, (w - 1)))) {
		return (aNumber - (SHL(1, w))) + 1;
	} else {
		return aNumber;
	}
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}

function stInit() {
	;
}

function storeJPEGStreamOn(streamOop) {
	interpreterProxy.storeIntegerofObjectwithValue(1, streamOop, jsPosition);
	interpreterProxy.storeIntegerofObjectwithValue(3, streamOop, jsBitBuffer);
	interpreterProxy.storeIntegerofObjectwithValue(4, streamOop, jsBitCount);
}

function yColorComponentFrom(oop) {
	return colorComponentfrom(yComponent, oop) && (colorComponentBlocksfrom(yBlocks, oop));
}


Squeak.registerExternalModule("JPEGReaderPlugin", {
	setInterpreter: setInterpreter,
	primitiveIdctInt: primitiveIdctInt,
	primitiveColorConvertMCU: primitiveColorConvertMCU,
	primitiveColorConvertGrayscaleMCU: primitiveColorConvertGrayscaleMCU,
	primitiveDecodeMCU: primitiveDecodeMCU,
	getModuleName: getModuleName,
});

}); // end of module

/***** including ../plugins/KedamaPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:21 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	KedamaPlugin Kedama-Plugins-yo.1 uuid: 3fc7d691-0149-ba4d-a339-5d27cd44a2f8
 */

module("users.bert.SqueakJS.plugins.KedamaPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var interpreterProxy = null;
var kedamaRandomSeed = 0;
var moduleName = "KedamaPlugin 3 November 2014 (e)";
var randA = 0;
var randM = 0;
var randQ = 0;
var randR = 0;


function degreesFromXy(x, y) {
	var tanVal;
	var theta;

	/* inline: true */;
	if (x === 0.0) {
		if (y >= 0.0) {
			return 90.0;
		} else {
			return 270.0;
		}
	} else {
		tanVal = y / x;
		theta = Math.atan(tanVal);
		if (x >= 0.0) {
			if (y >= 0.0) {
				return theta / 0.0174532925199433;
			} else {
				return 360.0 + (theta / 0.0174532925199433);
			}
		} else {
			return 180.0 + (theta / 0.0174532925199433);
		}
	}
	return 0.0;
}

function degreesToRadians(degrees) {
	var deg;
	var headingRadians;
	var q;

	/* inline: true */;
	deg = 90.0 - degrees;
	q = deg / 360.0|0;
	if (deg < 0.0) {
		--q;
	}
	headingRadians = (deg - (q * 360.0)) * 0.0174532925199433;
	return headingRadians;
}

function drawTurtlesInArray() {
	var bitsIndex;
	var colorArray;
	var colorOop;
	var destBits;
	var destHeight;
	var destOop;
	var destWidth;
	var i;
	var size;
	var visible;
	var visibleArray;
	var visibleOop;
	var x;
	var xArray;
	var xOop;
	var y;
	var yArray;
	var yOop;

	/* inline: true */;
	visibleOop = interpreterProxy.stackValue(0);
	colorOop = interpreterProxy.stackValue(1);
	yOop = interpreterProxy.stackValue(2);
	xOop = interpreterProxy.stackValue(3);
	destHeight = interpreterProxy.stackIntegerValue(4);
	destWidth = interpreterProxy.stackIntegerValue(5);
	destOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(destOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(colorOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isBytes(visibleOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if ((destHeight * destWidth) !== SIZEOF(destOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xOop);
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(colorOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(visibleOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	colorArray = colorOop.words;
	visibleArray = visibleOop.bytes;
	destBits = destOop.words;
	for (i = 0; i <= (size - 1); i++) {
		x = (xArray[i]|0);
		;
		y = (yArray[i]|0);
		;
		visible = visibleArray[i];
		if ((visible !== 0) && (((x >= 0) && (y >= 0)) && ((x < destWidth) && (y < destHeight)))) {
			bitsIndex = (y * destWidth) + x;
			destBits[bitsIndex] = colorArray[i];
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function getHeadingArrayInto() {
	var heading;
	var headingArray;
	var headingOop;
	var i;
	var resultArray;
	var resultOop;
	var size;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	headingOop = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(resultOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(headingOop);
	if (SIZEOF(resultOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	headingArray = headingOop.wordsAsFloat32Array();
	resultArray = resultOop.wordsAsFloat32Array();
	for (i = 0; i <= (size - 1); i++) {
		heading = headingArray[i];
		heading = heading / 0.0174532925199433;
		heading = 90.0 - heading;
		if (!(heading > 0.0)) {
			heading += 360.0;
		}
		resultArray[i] = heading;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(2);
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function getScalarHeading() {
	var heading;
	var headingArray;
	var headingOop;
	var index;

	/* inline: true */;
	headingOop = interpreterProxy.stackValue(0);
	index = interpreterProxy.stackIntegerValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) < index) {
		interpreterProxy.primitiveFail();
		return null;
	}
	headingArray = headingOop.wordsAsFloat32Array();
	heading = headingArray[index - 1];
	heading = radiansToDegrees(heading);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(3);
	interpreterProxy.pushFloat(heading);
}

function halt() {
	;
}

function initialiseModule() {
	kedamaRandomSeed = 17;

	/*  magic constant =      16807  */

	randA = 16807;

	/*  magic constant = 2147483647  */

	randM = 2147483647;
	randQ = DIV(randM, randA);
	randR = MOD(randM, randA);
}

function kedamaRandom2(range) {
	var hi;
	var lo;
	var r;
	var v;
	var val;

	/* inline: true */;
	if (range < 0) {
		r = 0 - range;
	} else {
		r = range;
	}
	hi = DIV(kedamaRandomSeed, randQ);
	lo = MOD(kedamaRandomSeed, randQ);
	kedamaRandomSeed = (randA * lo) - (randR * hi);
	v = kedamaRandomSeed & 65535;
	val = (v * (r + 1)) >>> 16;
	if (range < 0) {
		return 0 - val;
	} else {
		return val;
	}
}

function kedamaSetRandomSeed() {
	var seed;

	/* inline: true */;
	seed = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	kedamaRandomSeed = seed & 65536;
	interpreterProxy.pop(1);
}

function makeMask() {
	var alpha;
	var dOrigin;
	var data;
	var dataBits;
	var dataSize;
	var highMask;
	var i;
	var mOrigin;
	var maskBits;
	var maskSize;
	var pixel;
	var shiftAmount;

	/* inline: true */;
	shiftAmount = interpreterProxy.stackIntegerValue(0);
	pixel = interpreterProxy.stackIntegerValue(1);
	maskBits = interpreterProxy.stackValue(2);
	dataBits = interpreterProxy.stackValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	dataSize = SIZEOF(dataBits);
	maskSize = SIZEOF(maskBits);
	if (dataSize !== maskSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (shiftAmount < -32) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (shiftAmount > 8) {
		interpreterProxy.primitiveFail();
		return null;
	}
	dOrigin = dataBits.words;
	mOrigin = maskBits.words;
	highMask = 4278190080;
	for (i = 0; i <= (dataSize - 1); i++) {
		data = dOrigin[i];
		alpha = SHIFT(data, shiftAmount);
		if (alpha > 255) {
			alpha = 255;
		}
		if (alpha < 0) {
			alpha = 0;
		}
		mOrigin[i] = (((alpha << 24) & highMask) | pixel);
	}
	interpreterProxy.pop(4);
}

function makeMaskLog() {
	var alpha;
	var dOrigin;
	var data;
	var dataBits;
	var dataSize;
	var highMask;
	var i;
	var mOrigin;
	var maskBits;
	var maskSize;
	var max;
	var maxFirst;
	var maxLog;
	var maxOop;
	var pixel;

	/* inline: true */;
	maxOop = interpreterProxy.stackValue(0);
	pixel = interpreterProxy.stackIntegerValue(1);
	maskBits = interpreterProxy.stackValue(2);
	dataBits = interpreterProxy.stackValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	maxFirst = maxOop.words;
	max = maxFirst[0];
	if (interpreterProxy.failed()) {
		return null;
	}
	maxLog = Math.log(max);
	dataSize = SIZEOF(dataBits);
	maskSize = SIZEOF(maskBits);
	if (dataSize !== maskSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	dOrigin = dataBits.words;
	mOrigin = maskBits.words;
	highMask = 4278190080;
	for (i = 0; i <= (dataSize - 1); i++) {
		data = dOrigin[i];
		if (data === 0) {
			alpha = 0;
		} else {
			alpha = (((255.0 / maxLog) * Math.log(data))|0);
		}
		if (alpha > 255) {
			alpha = 255;
		}
		mOrigin[i] = (((alpha << 24) & highMask) | pixel);
	}
	interpreterProxy.pop(4);
}

function makeTurtlesMap() {
	var height;
	var index;
	var map;
	var mapIndex;
	var mapOop;
	var size;
	var whoArray;
	var whoOop;
	var width;
	var x;
	var xArray;
	var xOop;
	var y;
	var yArray;
	var yOop;

	/* inline: true */;
	height = interpreterProxy.stackIntegerValue(0);
	width = interpreterProxy.stackIntegerValue(1);
	yOop = interpreterProxy.stackValue(2);
	xOop = interpreterProxy.stackValue(3);
	whoOop = interpreterProxy.stackValue(4);
	mapOop = interpreterProxy.stackValue(5);
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(whoOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(mapOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(whoOop);
	if (SIZEOF(xOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(mapOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	whoArray = whoOop.words;
	map = mapOop.words;
	for (index = 0; index <= ((height * width) - 1); index++) {
		map[index] = 0;
	}
	for (index = 0; index <= (size - 1); index++) {
		x = xArray[index];
		y = yArray[index];
		mapIndex = (width * y) + x;
		if ((mapIndex >= 0) && (mapIndex < (height * width))) {
			map[mapIndex] = whoArray[index];
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function primPixelAtXY() {
	var bits;
	var bitsOop;
	var height;
	var index;
	var ret;
	var width;
	var x;
	var xPos;
	var y;
	var yPos;

	/* inline: true */;
	height = interpreterProxy.stackIntegerValue(0);
	width = interpreterProxy.stackIntegerValue(1);
	yPos = interpreterProxy.stackFloatValue(2);
	xPos = interpreterProxy.stackFloatValue(3);
	bitsOop = interpreterProxy.stackValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(bitsOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	x = xPos|0;
	y = yPos|0;
	bits = bitsOop.words;
	if ((((x >= 0) && (x < width)) && (y >= 0)) && (y < height)) {
		index = (y * width) + x;
		ret = bits[index];
	} else {
		ret = 0;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
	interpreterProxy.pushInteger(ret);
}

function primPixelAtXYPut() {
	var bits;
	var bitsOop;
	var height;
	var index;
	var v;
	var value;
	var width;
	var x;
	var xPos;
	var y;
	var yPos;

	/* inline: true */;
	height = interpreterProxy.stackIntegerValue(0);
	width = interpreterProxy.stackIntegerValue(1);
	value = interpreterProxy.stackIntegerValue(2);
	yPos = interpreterProxy.stackFloatValue(3);
	xPos = interpreterProxy.stackFloatValue(4);
	bitsOop = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(bitsOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	x = xPos|0;
	y = yPos|0;
	v = value;
	if (v > 1073741823) {
		v = 1073741823;
	}
	if (v < 0) {
		v = 0;
	}
	bits = bitsOop.words;
	if ((((x >= 0) && (x < width)) && (y >= 0)) && (y < height)) {
		index = (y * width) + x;
		bits[index] = v;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function primPixelsAtXY() {
	var bits;
	var bitsHeight;
	var bitsIndex;
	var bitsOop;
	var bitsWidth;
	var destWords;
	var destWordsOop;
	var i;
	var size;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	destWordsOop = interpreterProxy.stackValue(0);
	bitsHeight = interpreterProxy.stackIntegerValue(1);
	bitsWidth = interpreterProxy.stackIntegerValue(2);
	bitsOop = interpreterProxy.stackValue(3);
	yArrayOop = interpreterProxy.stackValue(4);
	xArrayOop = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(destWordsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if ((bitsHeight * bitsWidth) !== SIZEOF(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xArrayOop);
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(destWordsOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	destWords = destWordsOop.words;
	bits = bitsOop.words;
	for (i = 0; i <= (size - 1); i++) {
		x = (xArray[i]|0);
		;
		y = (yArray[i]|0);
		;
		if (((x >= 0) && (y >= 0)) && ((x < bitsWidth) && (y < bitsHeight))) {
			bitsIndex = (y * bitsWidth) + x;
			destWords[i] = bits[bitsIndex];
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function primScalarForward() {
	var bottomEdgeMode;
	var destHeight;
	var destWidth;
	var dist;
	var headingArray;
	var headingOop;
	var i;
	var index;
	var leftEdgeMode;
	var newX;
	var newY;
	var rightEdgeMode;
	var size;
	var topEdgeMode;
	var val;
	var xArray;
	var xOop;
	var yArray;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	rightEdgeMode = interpreterProxy.stackIntegerValue(2);
	leftEdgeMode = interpreterProxy.stackIntegerValue(3);
	destHeight = interpreterProxy.stackFloatValue(4);
	destWidth = interpreterProxy.stackFloatValue(5);
	val = interpreterProxy.stackFloatValue(6);
	headingOop = interpreterProxy.stackValue(7);
	yOop = interpreterProxy.stackValue(8);
	xOop = interpreterProxy.stackValue(9);
	index = interpreterProxy.stackIntegerValue(10);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xOop);
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	dist = val;
	i = index - 1;
	newX = xArray[i] + (dist * Math.cos(headingArray[i]));
	newY = yArray[i] - (dist * Math.sin(headingArray[i]));
	scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(i, xArray, headingArray, newX, destWidth, leftEdgeMode, rightEdgeMode);
	scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(i, yArray, headingArray, newY, destHeight, topEdgeMode, bottomEdgeMode);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(11);
}

function primSetPixelsAtXY() {
	var bits;
	var bitsHeight;
	var bitsIndex;
	var bitsOop;
	var bitsWidth;
	var i;
	var intValue;
	var isValueInt;
	var size;
	var value;
	var valueOop;
	var wordsValue;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	valueOop = interpreterProxy.stackValue(0);
	bitsHeight = interpreterProxy.stackIntegerValue(1);
	bitsWidth = interpreterProxy.stackIntegerValue(2);
	bitsOop = interpreterProxy.stackValue(3);
	yArrayOop = interpreterProxy.stackValue(4);
	xArrayOop = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if ((bitsHeight * bitsWidth) !== SIZEOF(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xArrayOop);
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	isValueInt = typeof valueOop === "number";
	if (isValueInt) {
		intValue = valueOop;
	}
	if (!isValueInt) {
		if (!interpreterProxy.isMemberOf(valueOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
		if (SIZEOF(valueOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	if (!isValueInt) {
		wordsValue = valueOop.words;
	}
	bits = bitsOop.words;
	if (isValueInt) {
		value = intValue;
	}
	for (i = 0; i <= (size - 1); i++) {
		x = (xArray[i]|0);
		;
		y = (yArray[i]|0);
		;
		if (((x >= 0) && (y >= 0)) && ((x < bitsWidth) && (y < bitsHeight))) {
			bitsIndex = (y * bitsWidth) + x;
			if (!isValueInt) {
				value = wordsValue[i];
			}
			bits[bitsIndex] = value;
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function primTurtlesForward() {
	var bottomEdgeMode;
	var destHeight;
	var destWidth;
	var dist;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var leftEdgeMode;
	var newX;
	var newY;
	var rightEdgeMode;
	var size;
	var topEdgeMode;
	var val;
	var valArray;
	var valOop;
	var xArray;
	var xOop;
	var yArray;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	rightEdgeMode = interpreterProxy.stackIntegerValue(2);
	leftEdgeMode = interpreterProxy.stackIntegerValue(3);
	destHeight = interpreterProxy.stackFloatValue(4);
	destWidth = interpreterProxy.stackFloatValue(5);
	valOop = interpreterProxy.stackValue(6);
	headingOop = interpreterProxy.stackValue(7);
	yOop = interpreterProxy.stackValue(8);
	xOop = interpreterProxy.stackValue(9);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (valOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(valOop)) {
			isValVector = true;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	size = SIZEOF(xOop);
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (isValVector) {
		if (SIZEOF(valOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		valArray = valOop.wordsAsFloat32Array();
	} else {
		val = interpreterProxy.floatValueOf(valOop);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (isValVector) {
			dist = valArray[i];
		} else {
			dist = val;
		}
		newX = xArray[i] + (dist * Math.cos(headingArray[i]));
		newY = yArray[i] - (dist * Math.sin(headingArray[i]));
		scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(i, xArray, headingArray, newX, destWidth, leftEdgeMode, rightEdgeMode);
		scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(i, yArray, headingArray, newY, destHeight, topEdgeMode, bottomEdgeMode);
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(10);
}

function primUpHill() {
	var bits;
	var bitsOop;
	var endX;
	var endY;
	var height;
	var maxVal;
	var maxValX;
	var maxValY;
	var ret;
	var rowOffset;
	var sniffRange;
	var startX;
	var startY;
	var tH;
	var tX;
	var tY;
	var thisVal;
	var turtleX;
	var turtleY;
	var width;
	var x;
	var y;

	/* inline: true */;
	sniffRange = interpreterProxy.stackIntegerValue(0);
	height = interpreterProxy.stackIntegerValue(1);
	width = interpreterProxy.stackIntegerValue(2);
	bitsOop = interpreterProxy.stackValue(3);
	tH = interpreterProxy.stackFloatValue(4);
	tY = interpreterProxy.stackFloatValue(5);
	tX = interpreterProxy.stackFloatValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(bitsOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	bits = bitsOop.words;
	turtleX = tX;
	turtleY = tY;
	turtleX = Math.max(turtleX, 0);
	turtleY = Math.max(turtleY, 0);
	turtleX = Math.min(turtleX, (width - 1));
	turtleY = Math.min(turtleY, (height - 1));
	startX = Math.max((turtleX - sniffRange), 0);
	endX = Math.min((turtleX + sniffRange), (width - 1));
	startY = Math.max((turtleY - sniffRange), 0);
	endY = Math.min((turtleY + sniffRange), (height - 1));
	maxVal = bits[(turtleY * width) + turtleX];
	maxValX = -1;
	for (y = startY; y <= endY; y++) {
		rowOffset = y * width;
		for (x = startX; x <= endX; x++) {
			thisVal = bits[rowOffset + x];
			if (thisVal > maxVal) {
				maxValX = x;
				maxValY = y;
				maxVal = thisVal;
			}
		}
	}
	if (-1 === maxValX) {
		ret = radiansToDegrees(tH);
	} else {
		ret = degreesFromXy((maxValX - turtleX), (maxValY - turtleY)) + 90.0|0;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(8);
	interpreterProxy.pushFloat(ret);
}

function primitiveAddArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] + wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] + floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveAddScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] + intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] + floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveDivArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] / wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] / floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveDivScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (DIV(wordsRcvr[i], intArg));
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] / floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveMulArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] * wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] * floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveMulScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] * intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] * floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveSubArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] - wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] - floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveSubScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] - intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] - floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function radiansToDegrees(radians) {
	var deg;
	var degrees;

	/* inline: true */;
	degrees = radians / 0.0174532925199433;
	deg = 90.0 - degrees;
	if (!(deg > 0.0)) {
		deg += 360.0;
	}
	return deg;
}

function randomIntoFloatArray() {
	var factor;
	var floatArray;
	var floatArrayOop;
	var from;
	var index;
	var range;
	var size;
	var to;

	/* inline: true */;
	factor = interpreterProxy.stackFloatValue(0);
	floatArrayOop = interpreterProxy.stackValue(1);
	to = interpreterProxy.stackIntegerValue(2);
	from = interpreterProxy.stackIntegerValue(3);
	range = interpreterProxy.stackIntegerValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(floatArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(floatArrayOop);
	if (!((size >= to) && ((from >= 1) && (to >= from)))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	floatArray = floatArrayOop.wordsAsFloat32Array();
	if (interpreterProxy.failed()) {
		return null;
	}
	for (index = from; index <= to; index++) {
		floatArray[index - 1] = (kedamaRandom2(range) * factor);
	}
	interpreterProxy.pop(5);
}

function randomIntoIntegerArray() {
	var factor;
	var from;
	var index;
	var integerArray;
	var integerArrayOop;
	var range;
	var size;
	var to;

	/* inline: true */;
	factor = interpreterProxy.stackFloatValue(0);
	integerArrayOop = interpreterProxy.stackValue(1);
	to = interpreterProxy.stackIntegerValue(2);
	from = interpreterProxy.stackIntegerValue(3);
	range = interpreterProxy.stackIntegerValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(integerArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(integerArrayOop);
	if (!((size >= to) && ((from >= 1) && (to >= from)))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	integerArray = integerArrayOop.words;
	if (interpreterProxy.failed()) {
		return null;
	}
	for (index = from; index <= to; index++) {
		integerArray[index - 1] = ((kedamaRandom2(range) * factor)|0);
	}
	interpreterProxy.pop(5);
}

function randomRange() {
	var range;
	var ret;

	/* inline: true */;
	range = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	ret = kedamaRandom2(range);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(2);
	interpreterProxy.pushInteger(ret);
}

function scalarGetAngleTo() {
	var fromX;
	var fromY;
	var r;
	var toX;
	var toY;
	var x;
	var y;

	/* inline: true */;
	fromY = interpreterProxy.stackFloatValue(0);
	fromX = interpreterProxy.stackFloatValue(1);
	toY = interpreterProxy.stackFloatValue(2);
	toX = interpreterProxy.stackFloatValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	x = toX - fromX;
	y = toY - fromY;
	r = degreesFromXy(x, y);
	r += 90.0;
	if (r > 360.0) {
		r -= 360.0;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(5);
	interpreterProxy.pushFloat(r);
}

function scalarGetDistanceTo() {
	var fromX;
	var fromY;
	var r;
	var toX;
	var toY;
	var x;
	var y;

	/* inline: true */;
	fromY = interpreterProxy.stackFloatValue(0);
	fromX = interpreterProxy.stackFloatValue(1);
	toY = interpreterProxy.stackFloatValue(2);
	toX = interpreterProxy.stackFloatValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	x = fromX - toX;
	y = fromY - toY;
	r = Math.sqrt((x * x) + (y * y));
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(5);
	interpreterProxy.pushFloat(r);
}

function scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(index, xArray, headingArray, val, destWidth, leftEdgeMode, rightEdgeMode) {
	var headingRadians;
	var newX;

	/* inline: true */;
	newX = val;
	if (newX < 0.0) {
		if (leftEdgeMode === 1) {

			/* wrap */

			newX += destWidth;
		}
		if (leftEdgeMode === 2) {

			/* stick */

			newX = 0.0;
		}
		if (leftEdgeMode === 3) {

			/* bounce */

			newX = 0.0 - newX;
			headingRadians = headingArray[index];
			if (headingRadians < 3.141592653589793) {
				headingArray[index] = (3.141592653589793 - headingRadians);
			} else {
				headingArray[index] = (9.42477796076938 - headingRadians);
			}
		}
	}
	if (newX >= destWidth) {
		if (rightEdgeMode === 1) {
			newX -= destWidth;
		}
		if (rightEdgeMode === 2) {
			newX = destWidth - 1.0e-6;
		}
		if (rightEdgeMode === 3) {
			newX = (destWidth - 1.0e-6) - (newX - destWidth);
			headingRadians = headingArray[index];
			if (headingRadians < 3.141592653589793) {
				headingArray[index] = (3.141592653589793 - headingRadians);
			} else {
				headingArray[index] = (9.42477796076938 - headingRadians);
			}
		}
	}
	xArray[index] = newX;
}

function scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(index, yArray, headingArray, val, destHeight, topEdgeMode, bottomEdgeMode) {
	var newY;

	/* inline: true */;
	newY = val;
	if (newY < 0.0) {
		if (topEdgeMode === 1) {

			/* wrap */

			newY += destHeight;
		}
		if (topEdgeMode === 2) {

			/* stick */

			newY = 0.0;
		}
		if (topEdgeMode === 3) {

			/* bounce */

			newY = 0.0 - newY;
			headingArray[index] = (6.283185307179586 - headingArray[index]);
		}
	}
	if (newY >= destHeight) {
		if (bottomEdgeMode === 1) {
			newY -= destHeight;
		}
		if (bottomEdgeMode === 2) {
			newY = destHeight - 1.0e-6;
		}
		if (bottomEdgeMode === 3) {
			newY = (destHeight - 1.0e-6) - (newY - destHeight);
			headingArray[index] = (6.283185307179586 - headingArray[index]);
		}
	}
	yArray[index] = newY;
}

function setHeadingArrayFrom() {
	var heading;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var resultArray;
	var resultOop;
	var size;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	headingOop = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(headingOop);
	if (resultOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(resultOop)) {
			if (SIZEOF(resultOop) !== size) {
				interpreterProxy.primitiveFail();
				return null;
			}
			isValVector = true;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		resultArray = resultOop.wordsAsFloat32Array();
	} else {
		heading = interpreterProxy.floatValueOf(resultOop);
		heading = degreesToRadians(heading);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (isValVector) {
			heading = resultArray[i];
			heading = degreesToRadians(heading);
		}
		headingArray[i] = heading;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(2);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}

function setScalarHeading() {
	var heading;
	var headingArray;
	var headingOop;
	var index;

	/* inline: true */;
	heading = interpreterProxy.stackFloatValue(0);
	headingOop = interpreterProxy.stackValue(1);
	index = interpreterProxy.stackIntegerValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) < index) {
		interpreterProxy.primitiveFail();
		return null;
	}
	headingArray = headingOop.wordsAsFloat32Array();
	headingArray[index - 1] = degreesToRadians(heading);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(3);
}

function shutdownModule() {
	return true;
}

function turtleScalarSetX() {
	var destWidth;
	var headingArray;
	var headingOop;
	var leftEdgeMode;
	var rightEdgeMode;
	var size;
	var val;
	var xArray;
	var xIndex;
	var xOop;

	/* inline: true */;
	rightEdgeMode = interpreterProxy.stackIntegerValue(0);
	leftEdgeMode = interpreterProxy.stackIntegerValue(1);
	destWidth = interpreterProxy.stackFloatValue(2);
	val = interpreterProxy.stackFloatValue(3);
	headingOop = interpreterProxy.stackValue(4);
	xIndex = interpreterProxy.stackIntegerValue(5);
	xOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xOop);
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(xIndex - 1, xArray, headingArray, val, destWidth, leftEdgeMode, rightEdgeMode);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function turtleScalarSetY() {
	var bottomEdgeMode;
	var destHeight;
	var headingArray;
	var headingOop;
	var size;
	var topEdgeMode;
	var val;
	var yArray;
	var yIndex;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	destHeight = interpreterProxy.stackFloatValue(2);
	val = interpreterProxy.stackFloatValue(3);
	headingOop = interpreterProxy.stackValue(4);
	yIndex = interpreterProxy.stackIntegerValue(5);
	yOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(yOop);
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(yIndex - 1, yArray, headingArray, val, destHeight, topEdgeMode, bottomEdgeMode);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function turtlesSetX() {
	var destWidth;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var leftEdgeMode;
	var newX;
	var rightEdgeMode;
	var size;
	var val;
	var valArray;
	var valOop;
	var xArray;
	var xOop;

	/* inline: true */;
	rightEdgeMode = interpreterProxy.stackIntegerValue(0);
	leftEdgeMode = interpreterProxy.stackIntegerValue(1);
	destWidth = interpreterProxy.stackFloatValue(2);
	valOop = interpreterProxy.stackValue(3);
	headingOop = interpreterProxy.stackValue(4);
	xOop = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (valOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(valOop)) {
			isValVector = true;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	size = SIZEOF(xOop);
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (isValVector) {
		if (SIZEOF(valOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	xArray = xOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		valArray = valOop.wordsAsFloat32Array();
	} else {
		val = interpreterProxy.floatValueOf(valOop);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (isValVector) {
			newX = valArray[i];
		} else {
			newX = val;
		}
		scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(i, xArray, headingArray, newX, destWidth, leftEdgeMode, rightEdgeMode);
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function turtlesSetY() {
	var bottomEdgeMode;
	var destHeight;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var newY;
	var size;
	var topEdgeMode;
	var val;
	var valArray;
	var valOop;
	var yArray;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	destHeight = interpreterProxy.stackFloatValue(2);
	valOop = interpreterProxy.stackValue(3);
	headingOop = interpreterProxy.stackValue(4);
	yOop = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (valOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(valOop)) {
			isValVector = true;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	size = SIZEOF(yOop);
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (isValVector) {
		if (SIZEOF(valOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		valArray = valOop.wordsAsFloat32Array();
	} else {
		val = interpreterProxy.floatValueOf(valOop);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (isValVector) {
			newY = valArray[i];
		} else {
			newY = val;
		}
		scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(i, yArray, headingArray, newY, destHeight, topEdgeMode, bottomEdgeMode);
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function vectorGetAngleTo() {
	var index;
	var isVector;
	var pX;
	var pXOop;
	var pY;
	var pYOop;
	var ppx;
	var ppy;
	var r;
	var result;
	var resultOop;
	var size;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	yArrayOop = interpreterProxy.stackValue(1);
	xArrayOop = interpreterProxy.stackValue(2);
	pYOop = interpreterProxy.stackValue(3);
	pXOop = interpreterProxy.stackValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(resultOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(resultOop);
	if (size < 0) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(xArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (pXOop.isFloat) {
		if (pYOop.isFloat) {
			isVector = false;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (pYOop.isFloat) {
			interpreterProxy.primitiveFail();
			return null;
		} else {
			isVector = true;
		}
	}
	if (isVector) {
		if (SIZEOF(pXOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
		if (SIZEOF(pYOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	result = resultOop.wordsAsFloat32Array();
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	if (isVector) {
		pX = pXOop.wordsAsFloat32Array();
		pY = pYOop.wordsAsFloat32Array();
	}
	if (!isVector) {
		ppx = interpreterProxy.floatValueOf(pXOop);
		ppy = interpreterProxy.floatValueOf(pYOop);
	}
	for (index = 0; index <= (size - 1); index++) {
		if (isVector) {
			ppx = pX[index];
			ppy = pY[index];
		}
		x = ppx - xArray[index];
		y = ppy - yArray[index];
		r = degreesFromXy(x, y);
		r += 90.0;
		if (r > 360.0) {
			r -= 360.0;
		}
		result[index] = r;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
	interpreterProxy.push(resultOop);
}

function vectorGetDistanceTo() {
	var index;
	var isVector;
	var pX;
	var pXOop;
	var pY;
	var pYOop;
	var ppx;
	var ppy;
	var result;
	var resultOop;
	var size;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	yArrayOop = interpreterProxy.stackValue(1);
	xArrayOop = interpreterProxy.stackValue(2);
	pYOop = interpreterProxy.stackValue(3);
	pXOop = interpreterProxy.stackValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(resultOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(resultOop);
	if (size < 0) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(xArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (pXOop.isFloat) {
		if (pYOop.isFloat) {
			isVector = false;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (pYOop.isFloat) {
			interpreterProxy.primitiveFail();
			return null;
		} else {
			isVector = true;
		}
	}
	if (isVector) {
		if (SIZEOF(pXOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
		if (SIZEOF(pYOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	result = resultOop.wordsAsFloat32Array();
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	if (isVector) {
		pX = pXOop.wordsAsFloat32Array();
		pY = pYOop.wordsAsFloat32Array();
	}
	if (!isVector) {
		ppx = interpreterProxy.floatValueOf(pXOop);
		ppy = interpreterProxy.floatValueOf(pYOop);
	}
	for (index = 0; index <= (size - 1); index++) {
		if (isVector) {
			ppx = pX[index];
			ppy = pY[index];
		}
		x = ppx - xArray[index];
		y = ppy - yArray[index];
		result[index] = Math.sqrt((x * x) + (y * y));
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
	interpreterProxy.push(resultOop);
}

function zoomBitmap() {
	var bit;
	var dOrigin;
	var dst;
	var dstIndex;
	var dstSize;
	var dummy;
	var sHeight;
	var sOrigin;
	var sWidth;
	var src;
	var srcIndex;
	var srcOrigin;
	var srcSize;
	var sx;
	var sy;
	var xFactor;
	var y;
	var yFactor;

	/* inline: true */;
	yFactor = interpreterProxy.stackIntegerValue(0);
	xFactor = interpreterProxy.stackIntegerValue(1);
	sHeight = interpreterProxy.stackIntegerValue(2);
	sWidth = interpreterProxy.stackIntegerValue(3);
	dst = interpreterProxy.stackValue(4);
	src = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	srcSize = SIZEOF(src);
	dstSize = SIZEOF(dst);
	if ((sWidth * sHeight) !== srcSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (((srcSize * xFactor) * yFactor) !== dstSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	sOrigin = src.words;
	dOrigin = dst.words;
	srcIndex = 0;
	srcOrigin = 0;
	dstIndex = 0;
	for (sy = 0; sy <= (sHeight - 1); sy++) {
		for (y = 0; y <= (yFactor - 1); y++) {
			for (sx = 0; sx <= (sWidth - 1); sx++) {
				bit = sOrigin[srcIndex];
				++srcIndex;
				for (dummy = 0; dummy <= (xFactor - 1); dummy++) {
					dOrigin[dstIndex] = bit;
					++dstIndex;
				}
			}
			srcIndex = srcOrigin;
		}
		srcOrigin += sWidth;
		srcIndex = srcOrigin;
	}
	interpreterProxy.pop(6);
}


Squeak.registerExternalModule("KedamaPlugin", {
	makeMaskLog: makeMaskLog,
	vectorGetDistanceTo: vectorGetDistanceTo,
	getScalarHeading: getScalarHeading,
	shutdownModule: shutdownModule,
	primitiveAddScalar: primitiveAddScalar,
	primSetPixelsAtXY: primSetPixelsAtXY,
	turtleScalarSetX: turtleScalarSetX,
	primPixelAtXY: primPixelAtXY,
	primUpHill: primUpHill,
	primScalarForward: primScalarForward,
	primitiveDivArrays: primitiveDivArrays,
	getModuleName: getModuleName,
	primitiveSubArrays: primitiveSubArrays,
	scalarGetAngleTo: scalarGetAngleTo,
	randomRange: randomRange,
	setInterpreter: setInterpreter,
	kedamaSetRandomSeed: kedamaSetRandomSeed,
	drawTurtlesInArray: drawTurtlesInArray,
	turtleScalarSetY: turtleScalarSetY,
	randomIntoIntegerArray: randomIntoIntegerArray,
	getHeadingArrayInto: getHeadingArrayInto,
	makeTurtlesMap: makeTurtlesMap,
	setHeadingArrayFrom: setHeadingArrayFrom,
	turtlesSetX: turtlesSetX,
	setScalarHeading: setScalarHeading,
	makeMask: makeMask,
	primitiveDivScalar: primitiveDivScalar,
	primitiveSubScalar: primitiveSubScalar,
	primPixelsAtXY: primPixelsAtXY,
	vectorGetAngleTo: vectorGetAngleTo,
	primitiveMulArrays: primitiveMulArrays,
	primPixelAtXYPut: primPixelAtXYPut,
	zoomBitmap: zoomBitmap,
	initialiseModule: initialiseModule,
	primitiveAddArrays: primitiveAddArrays,
	scalarGetDistanceTo: scalarGetDistanceTo,
	turtlesSetY: turtlesSetY,
	randomIntoFloatArray: randomIntoFloatArray,
	primTurtlesForward: primTurtlesForward,
	primitiveMulScalar: primitiveMulScalar,
});

}); // end of module

/***** including ../plugins/KedamaPlugin2.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:21 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	KedamaPlugin2 Kedama-Plugins-yo.1 uuid: 3fc7d691-0149-ba4d-a339-5d27cd44a2f8
 */

module("users.bert.SqueakJS.plugins.KedamaPlugin2").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var interpreterProxy = null;
var kedamaRandomSeed = 0;
var moduleName = "KedamaPlugin2 3 November 2014 (e)";
var randA = 0;
var randM = 0;
var randQ = 0;
var randR = 0;


function degreesFromXy(x, y) {
	var tanVal;
	var theta;

	/* inline: true */;
	if (x === 0.0) {
		if (y >= 0.0) {
			return 90.0;
		} else {
			return 270.0;
		}
	} else {
		tanVal = y / x;
		theta = Math.atan(tanVal);
		if (x >= 0.0) {
			if (y >= 0.0) {
				return theta / 0.0174532925199433;
			} else {
				return 360.0 + (theta / 0.0174532925199433);
			}
		} else {
			return 180.0 + (theta / 0.0174532925199433);
		}
	}
	return 0.0;
}

function degreesToRadians(degrees) {
	var deg;
	var headingRadians;
	var q;

	/* inline: true */;
	deg = 90.0 - degrees;
	q = deg / 360.0|0;
	if (deg < 0.0) {
		--q;
	}
	headingRadians = (deg - (q * 360.0)) * 0.0174532925199433;
	return headingRadians;
}

function drawTurtlesInArray() {
	var bitsIndex;
	var colorArray;
	var colorOop;
	var destBits;
	var destHeight;
	var destOop;
	var destWidth;
	var i;
	var size;
	var visible;
	var visibleArray;
	var visibleOop;
	var x;
	var xArray;
	var xOop;
	var y;
	var yArray;
	var yOop;

	/* inline: true */;
	visibleOop = interpreterProxy.stackValue(0);
	colorOop = interpreterProxy.stackValue(1);
	yOop = interpreterProxy.stackValue(2);
	xOop = interpreterProxy.stackValue(3);
	destHeight = interpreterProxy.stackIntegerValue(4);
	destWidth = interpreterProxy.stackIntegerValue(5);
	destOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(destOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(colorOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isBytes(visibleOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if ((destHeight * destWidth) !== SIZEOF(destOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xOop);
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(colorOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(visibleOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	colorArray = colorOop.words;
	visibleArray = visibleOop.bytes;
	destBits = destOop.words;
	for (i = 0; i <= (size - 1); i++) {
		x = (xArray[i]|0);
		;
		y = (yArray[i]|0);
		;
		visible = visibleArray[i];
		if ((visible !== 0) && (((x >= 0) && (y >= 0)) && ((x < destWidth) && (y < destHeight)))) {
			bitsIndex = (y * destWidth) + x;
			destBits[bitsIndex] = colorArray[i];
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function getHeadingArrayInto() {
	var heading;
	var headingArray;
	var headingOop;
	var i;
	var resultArray;
	var resultOop;
	var size;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	headingOop = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(resultOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(headingOop);
	if (SIZEOF(resultOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	headingArray = headingOop.wordsAsFloat32Array();
	resultArray = resultOop.wordsAsFloat32Array();
	for (i = 0; i <= (size - 1); i++) {
		heading = headingArray[i];
		heading = heading / 0.0174532925199433;
		heading = 90.0 - heading;
		if (!(heading > 0.0)) {
			heading += 360.0;
		}
		resultArray[i] = heading;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(2);
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function getScalarHeading() {
	var heading;
	var headingArray;
	var headingOop;
	var index;

	/* inline: true */;
	headingOop = interpreterProxy.stackValue(0);
	index = interpreterProxy.stackIntegerValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) < index) {
		interpreterProxy.primitiveFail();
		return null;
	}
	headingArray = headingOop.wordsAsFloat32Array();
	heading = headingArray[index - 1];
	heading = radiansToDegrees(heading);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(3);
	interpreterProxy.pushFloat(heading);
}

function halt() {
	;
}

function initialiseModule() {
	kedamaRandomSeed = 17;

	/*  magic constant =      16807  */

	randA = 16807;

	/*  magic constant = 2147483647  */

	randM = 2147483647;
	randQ = DIV(randM, randA);
	randR = MOD(randM, randA);
}

function kedamaRandom2(range) {
	var hi;
	var lo;
	var r;
	var v;
	var val;

	/* inline: true */;
	if (range < 0) {
		r = 0 - range;
	} else {
		r = range;
	}
	hi = DIV(kedamaRandomSeed, randQ);
	lo = MOD(kedamaRandomSeed, randQ);
	kedamaRandomSeed = (randA * lo) - (randR * hi);
	v = kedamaRandomSeed & 65535;
	val = (v * (r + 1)) >>> 16;
	if (range < 0) {
		return 0 - val;
	} else {
		return val;
	}
}

function kedamaSetRandomSeed() {
	var seed;

	/* inline: true */;
	seed = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	kedamaRandomSeed = seed & 65536;
	interpreterProxy.pop(1);
}

function makeMask() {
	var alpha;
	var dOrigin;
	var data;
	var dataBits;
	var dataSize;
	var highMask;
	var i;
	var mOrigin;
	var maskBits;
	var maskSize;
	var pixel;
	var shiftAmount;

	/* inline: true */;
	shiftAmount = interpreterProxy.stackIntegerValue(0);
	pixel = interpreterProxy.stackIntegerValue(1);
	maskBits = interpreterProxy.stackValue(2);
	dataBits = interpreterProxy.stackValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	dataSize = SIZEOF(dataBits);
	maskSize = SIZEOF(maskBits);
	if (dataSize !== maskSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (shiftAmount < -32) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (shiftAmount > 8) {
		interpreterProxy.primitiveFail();
		return null;
	}
	dOrigin = dataBits.words;
	mOrigin = maskBits.words;
	highMask = 4278190080;
	for (i = 0; i <= (dataSize - 1); i++) {
		data = dOrigin[i];
		alpha = SHIFT(data, shiftAmount);
		if (alpha > 255) {
			alpha = 255;
		}
		if (alpha < 0) {
			alpha = 0;
		}
		mOrigin[i] = (((alpha << 24) & highMask) | pixel);
	}
	interpreterProxy.pop(4);
}

function makeMaskLog() {
	var alpha;
	var dOrigin;
	var data;
	var dataBits;
	var dataSize;
	var highMask;
	var i;
	var mOrigin;
	var maskBits;
	var maskSize;
	var max;
	var maxFirst;
	var maxLog;
	var maxOop;
	var pixel;

	/* inline: true */;
	maxOop = interpreterProxy.stackValue(0);
	pixel = interpreterProxy.stackIntegerValue(1);
	maskBits = interpreterProxy.stackValue(2);
	dataBits = interpreterProxy.stackValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	maxFirst = maxOop.words;
	max = maxFirst[0];
	if (interpreterProxy.failed()) {
		return null;
	}
	maxLog = Math.log(max);
	dataSize = SIZEOF(dataBits);
	maskSize = SIZEOF(maskBits);
	if (dataSize !== maskSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	dOrigin = dataBits.words;
	mOrigin = maskBits.words;
	highMask = 4278190080;
	for (i = 0; i <= (dataSize - 1); i++) {
		data = dOrigin[i];
		if (data === 0) {
			alpha = 0;
		} else {
			alpha = (((255.0 / maxLog) * Math.log(data))|0);
		}
		if (alpha > 255) {
			alpha = 255;
		}
		mOrigin[i] = (((alpha << 24) & highMask) | pixel);
	}
	interpreterProxy.pop(4);
}

function makeTurtlesMap() {
	var height;
	var index;
	var map;
	var mapIndex;
	var mapOop;
	var size;
	var whoArray;
	var whoOop;
	var width;
	var x;
	var xArray;
	var xOop;
	var y;
	var yArray;
	var yOop;

	/* inline: true */;
	height = interpreterProxy.stackIntegerValue(0);
	width = interpreterProxy.stackIntegerValue(1);
	yOop = interpreterProxy.stackValue(2);
	xOop = interpreterProxy.stackValue(3);
	whoOop = interpreterProxy.stackValue(4);
	mapOop = interpreterProxy.stackValue(5);
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(whoOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(mapOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(whoOop);
	if (SIZEOF(xOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(mapOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	whoArray = whoOop.words;
	map = mapOop.words;
	for (index = 0; index <= ((height * width) - 1); index++) {
		map[index] = 0;
	}
	for (index = 0; index <= (size - 1); index++) {
		x = xArray[index];
		y = yArray[index];
		mapIndex = (width * y) + x;
		if ((mapIndex >= 0) && (mapIndex < (height * width))) {
			map[mapIndex] = whoArray[index];
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function primPixelAtXY() {
	var bits;
	var bitsOop;
	var height;
	var index;
	var ret;
	var width;
	var x;
	var xPos;
	var y;
	var yPos;

	/* inline: true */;
	height = interpreterProxy.stackIntegerValue(0);
	width = interpreterProxy.stackIntegerValue(1);
	yPos = interpreterProxy.stackFloatValue(2);
	xPos = interpreterProxy.stackFloatValue(3);
	bitsOop = interpreterProxy.stackValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(bitsOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	x = xPos|0;
	y = yPos|0;
	bits = bitsOop.words;
	if ((((x >= 0) && (x < width)) && (y >= 0)) && (y < height)) {
		index = (y * width) + x;
		ret = bits[index];
	} else {
		ret = 0;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
	interpreterProxy.pushInteger(ret);
}

function primPixelAtXYPut() {
	var bits;
	var bitsOop;
	var height;
	var index;
	var v;
	var value;
	var width;
	var x;
	var xPos;
	var y;
	var yPos;

	/* inline: true */;
	height = interpreterProxy.stackIntegerValue(0);
	width = interpreterProxy.stackIntegerValue(1);
	value = interpreterProxy.stackIntegerValue(2);
	yPos = interpreterProxy.stackFloatValue(3);
	xPos = interpreterProxy.stackFloatValue(4);
	bitsOop = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(bitsOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	x = xPos|0;
	y = yPos|0;
	v = value;
	if (v > 1073741823) {
		v = 1073741823;
	}
	if (v < 0) {
		v = 0;
	}
	bits = bitsOop.words;
	if ((((x >= 0) && (x < width)) && (y >= 0)) && (y < height)) {
		index = (y * width) + x;
		bits[index] = v;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function primPixelsAtXY() {
	var bits;
	var bitsHeight;
	var bitsIndex;
	var bitsOop;
	var bitsWidth;
	var destWords;
	var destWordsOop;
	var i;
	var size;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	destWordsOop = interpreterProxy.stackValue(0);
	bitsHeight = interpreterProxy.stackIntegerValue(1);
	bitsWidth = interpreterProxy.stackIntegerValue(2);
	bitsOop = interpreterProxy.stackValue(3);
	yArrayOop = interpreterProxy.stackValue(4);
	xArrayOop = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(destWordsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if ((bitsHeight * bitsWidth) !== SIZEOF(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xArrayOop);
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(destWordsOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	destWords = destWordsOop.words;
	bits = bitsOop.words;
	for (i = 0; i <= (size - 1); i++) {
		x = (xArray[i]|0);
		;
		y = (yArray[i]|0);
		;
		if (((x >= 0) && (y >= 0)) && ((x < bitsWidth) && (y < bitsHeight))) {
			bitsIndex = (y * bitsWidth) + x;
			destWords[i] = bits[bitsIndex];
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
}

function primScalarForward() {
	var bottomEdgeMode;
	var destHeight;
	var destWidth;
	var dist;
	var headingArray;
	var headingOop;
	var i;
	var index;
	var leftEdgeMode;
	var newX;
	var newY;
	var rightEdgeMode;
	var size;
	var topEdgeMode;
	var val;
	var xArray;
	var xOop;
	var yArray;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	rightEdgeMode = interpreterProxy.stackIntegerValue(2);
	leftEdgeMode = interpreterProxy.stackIntegerValue(3);
	destHeight = interpreterProxy.stackFloatValue(4);
	destWidth = interpreterProxy.stackFloatValue(5);
	val = interpreterProxy.stackFloatValue(6);
	headingOop = interpreterProxy.stackValue(7);
	yOop = interpreterProxy.stackValue(8);
	xOop = interpreterProxy.stackValue(9);
	index = interpreterProxy.stackIntegerValue(10);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xOop);
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	dist = val;
	i = index - 1;
	newX = xArray[i] + (dist * Math.cos(headingArray[i]));
	newY = yArray[i] - (dist * Math.sin(headingArray[i]));
	scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(i, xArray, headingArray, newX, destWidth, leftEdgeMode, rightEdgeMode);
	scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(i, yArray, headingArray, newY, destHeight, topEdgeMode, bottomEdgeMode);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(11);
}

function primSetPixelsAtXY() {
	var bits;
	var bitsHeight;
	var bitsIndex;
	var bitsOop;
	var bitsWidth;
	var floatsValue;
	var fv;
	var i;
	var intValue;
	var isValueInt;
	var isValueWordArray;
	var pArray;
	var pArrayOop;
	var size;
	var value;
	var valueOop;
	var wordsValue;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	valueOop = interpreterProxy.stackValue(0);
	bitsHeight = interpreterProxy.stackIntegerValue(1);
	bitsWidth = interpreterProxy.stackIntegerValue(2);
	bitsOop = interpreterProxy.stackValue(3);
	yArrayOop = interpreterProxy.stackValue(4);
	xArrayOop = interpreterProxy.stackValue(5);
	pArrayOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(pArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if ((bitsHeight * bitsWidth) !== SIZEOF(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xArrayOop);
	if (SIZEOF(pArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	pArray = pArrayOop.bytes;
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	isValueInt = typeof valueOop === "number";
	if (isValueInt) {
		intValue = valueOop;
		value = intValue;
	} else {
		if (SIZEOF(valueOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
		isValueWordArray = interpreterProxy.isMemberOf(valueOop, "WordArray");
		if (isValueWordArray) {
			wordsValue = valueOop.words;
		} else {
			floatsValue = valueOop.wordsAsFloat32Array();
		}
	}
	bits = bitsOop.words;
	for (i = 0; i <= (size - 1); i++) {
		if (pArray[i] === 1) {
			x = (xArray[i]|0);
			;
			y = (yArray[i]|0);
			;
			if (((x >= 0) && (y >= 0)) && ((x < bitsWidth) && (y < bitsHeight))) {
				bitsIndex = (y * bitsWidth) + x;
				if (isValueInt) {
					bits[bitsIndex] = value;
				} else {
					if (isValueWordArray) {
						bits[bitsIndex] = wordsValue[i];
					} else {
						fv = floatsValue[i];
						;
						bits[bitsIndex] = fv;
					}
				}
			}
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function primTurtlesForward() {
	var bottomEdgeMode;
	var destHeight;
	var destWidth;
	var dist;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var leftEdgeMode;
	var newX;
	var newY;
	var pArray;
	var pOop;
	var rightEdgeMode;
	var size;
	var topEdgeMode;
	var val;
	var valArray;
	var valOop;
	var xArray;
	var xOop;
	var yArray;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	rightEdgeMode = interpreterProxy.stackIntegerValue(2);
	leftEdgeMode = interpreterProxy.stackIntegerValue(3);
	destHeight = interpreterProxy.stackFloatValue(4);
	destWidth = interpreterProxy.stackFloatValue(5);
	valOop = interpreterProxy.stackValue(6);
	headingOop = interpreterProxy.stackValue(7);
	yOop = interpreterProxy.stackValue(8);
	xOop = interpreterProxy.stackValue(9);
	pOop = interpreterProxy.stackValue(10);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(pOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (valOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(valOop)) {
			isValVector = true;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	size = SIZEOF(xOop);
	if (SIZEOF(yOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(pOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (isValVector) {
		if (SIZEOF(valOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	pArray = pOop.bytes;
	xArray = xOop.wordsAsFloat32Array();
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		valArray = valOop.wordsAsFloat32Array();
	} else {
		val = interpreterProxy.floatValueOf(valOop);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (pArray[i] === 1) {
			if (isValVector) {
				dist = valArray[i];
			} else {
				dist = val;
			}
			newX = xArray[i] + (dist * Math.cos(headingArray[i]));
			newY = yArray[i] - (dist * Math.sin(headingArray[i]));
			scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(i, xArray, headingArray, newX, destWidth, leftEdgeMode, rightEdgeMode);
			scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(i, yArray, headingArray, newY, destHeight, topEdgeMode, bottomEdgeMode);
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(11);
}

function primUpHill() {
	var bits;
	var bitsOop;
	var endX;
	var endY;
	var height;
	var maxVal;
	var maxValX;
	var maxValY;
	var ret;
	var rowOffset;
	var sniffRange;
	var startX;
	var startY;
	var tH;
	var tX;
	var tY;
	var thisVal;
	var turtleX;
	var turtleY;
	var width;
	var x;
	var y;

	/* inline: true */;
	sniffRange = interpreterProxy.stackIntegerValue(0);
	height = interpreterProxy.stackIntegerValue(1);
	width = interpreterProxy.stackIntegerValue(2);
	bitsOop = interpreterProxy.stackValue(3);
	tH = interpreterProxy.stackFloatValue(4);
	tY = interpreterProxy.stackFloatValue(5);
	tX = interpreterProxy.stackFloatValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(bitsOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(bitsOop) !== (height * width)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	bits = bitsOop.words;
	turtleX = tX;
	turtleY = tY;
	turtleX = Math.max(turtleX, 0);
	turtleY = Math.max(turtleY, 0);
	turtleX = Math.min(turtleX, (width - 1));
	turtleY = Math.min(turtleY, (height - 1));
	startX = Math.max((turtleX - sniffRange), 0);
	endX = Math.min((turtleX + sniffRange), (width - 1));
	startY = Math.max((turtleY - sniffRange), 0);
	endY = Math.min((turtleY + sniffRange), (height - 1));
	maxVal = bits[(turtleY * width) + turtleX];
	maxValX = -1;
	for (y = startY; y <= endY; y++) {
		rowOffset = y * width;
		for (x = startX; x <= endX; x++) {
			thisVal = bits[rowOffset + x];
			if (thisVal > maxVal) {
				maxValX = x;
				maxValY = y;
				maxVal = thisVal;
			}
		}
	}
	if (-1 === maxValX) {
		ret = radiansToDegrees(tH);
	} else {
		ret = degreesFromXy((maxValX - turtleX), (maxValY - turtleY)) + 90.0|0;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(8);
	interpreterProxy.pushFloat(ret);
}

function primitiveAddArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] + wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] + floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveAddScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] + intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] + floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] + floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveAndByteArray() {
	var i;
	var length;
	var length1;
	var length2;
	var otherArray;
	var otherOop;
	var rcvrArray;
	var rcvrOop;

	/* inline: true */;
	otherOop = interpreterProxy.stackObjectValue(0);
	rcvrOop = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isBytes(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(otherOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length1 = SIZEOF(rcvrOop);
	length2 = SIZEOF(otherOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	length = length1;
	if (length1 > length2) {
		length = length2;
	}
	otherArray = otherOop.bytes;
	rcvrArray = rcvrOop.bytes;
	for (i = 0; i <= (length - 1); i++) {
		rcvrArray[i] = ((rcvrArray[i] + otherArray[i]) === 2);
	}
	interpreterProxy.pop(1);
}

function primitiveDivArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] / wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] / floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveDivScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (DIV(wordsRcvr[i], intArg));
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] / floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] / floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveEQArrays() {
	var argOop;
	var bytesResult;
	var floatsArg;
	var floatsRcvr;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] === wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] === floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] === wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] === floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveEQScalar() {
	var argOop;
	var bytesResult;
	var floatArg;
	var floatsRcvr;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] === intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] === floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] === intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] === floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveGEArrays() {
	var argOop;
	var bytesResult;
	var floatsArg;
	var floatsRcvr;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] >= wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] >= floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] >= wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] >= floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveGEScalar() {
	var argOop;
	var bytesResult;
	var floatArg;
	var floatsRcvr;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] >= intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] >= floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] >= intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] >= floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveGTArrays() {
	var argOop;
	var bytesResult;
	var floatsArg;
	var floatsRcvr;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] > wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] > floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] > wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] > floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveGTScalar() {
	var argOop;
	var bytesResult;
	var floatArg;
	var floatsRcvr;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] > intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] > floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] > intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] > floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveLEArrays() {
	var argOop;
	var bytesResult;
	var floatsArg;
	var floatsRcvr;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] <= wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] <= floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] <= wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] <= floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveLEScalar() {
	var argOop;
	var bytesResult;
	var floatArg;
	var floatsRcvr;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] <= intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] <= floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] <= intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] <= floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveLTArrays() {
	var argOop;
	var bytesResult;
	var floatsArg;
	var floatsRcvr;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] < wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] < floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] < wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] < floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveLTScalar() {
	var argOop;
	var bytesResult;
	var floatArg;
	var floatsRcvr;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] < intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] < floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] < intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] < floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveMulArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] * wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] * floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveMulScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] * intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] * floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] * floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveNEArrays() {
	var argOop;
	var bytesResult;
	var floatsArg;
	var floatsRcvr;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] !== wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] !== floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] !== wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] !== floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveNEScalar() {
	var argOop;
	var bytesResult;
	var floatArg;
	var floatsRcvr;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] !== intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (wordsRcvr[i] !== floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] !== intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			bytesResult = resultOop.bytes;
			for (i = 0; i <= (length - 1); i++) {
				bytesResult[i] = (floatsRcvr[i] !== floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveNotByteArray() {
	var i;
	var length;
	var rcvrArray;
	var rcvrOop;

	/* inline: true */;
	rcvrOop = interpreterProxy.stackValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isBytes(rcvrOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	rcvrArray = rcvrOop.bytes;
	for (i = 0; i <= (length - 1); i++) {
		if (rcvrArray[i] === 0) {
			rcvrArray[i] = 1;
		} else {
			rcvrArray[i] = 0;
		}
	}
}

function primitiveOrByteArray() {
	var i;
	var length;
	var length1;
	var length2;
	var otherArray;
	var otherOop;
	var rcvrArray;
	var rcvrOop;

	/* inline: true */;
	otherOop = interpreterProxy.stackObjectValue(0);
	rcvrOop = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isBytes(rcvrOop));
	interpreterProxy.success(interpreterProxy.isBytes(otherOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length1 = SIZEOF(rcvrOop);
	length2 = SIZEOF(otherOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	length = length1;
	if (length1 > length2) {
		length = length2;
	}
	otherArray = otherOop.bytes;
	rcvrArray = rcvrOop.bytes;
	for (i = 0; i <= (length - 1); i++) {
		rcvrArray[i] = ((rcvrArray[i] + otherArray[i]) > 0);
	}
	interpreterProxy.pop(1);
}

function primitivePredicateAtAllPutBoolean() {
	var i;
	var predicates;
	var predicatesOop;
	var rcvrOop;
	var val;
	var valOop;
	var values;
	var valuesOop;

	/* inline: true */;
	valOop = interpreterProxy.stackValue(0);
	rcvrOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (interpreterProxy.isIntegerValue(valOop)) {
		val = valOop;
	} else {
		val = interpreterProxy.booleanValueOf(valOop);
	}
	valuesOop = interpreterProxy.fetchPointerofObject(1, rcvrOop);
	predicatesOop = interpreterProxy.fetchPointerofObject(0, rcvrOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(predicatesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isBytes(valuesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	values = valuesOop.bytes;
	predicates = predicatesOop.bytes;
	for (i = 0; i <= (SIZEOF(valuesOop) - 1); i++) {
		if (predicates[i] === 1) {
			values[i] = val;
		}
	}
	interpreterProxy.pop(1);
}

function primitivePredicateAtAllPutColor() {
	var i;
	var predicates;
	var predicatesOop;
	var rcvrOop;
	var val;
	var values;
	var valuesOop;

	/* inline: true */;
	val = interpreterProxy.stackIntegerValue(0);
	rcvrOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	val = val | 4278190080;
	valuesOop = interpreterProxy.fetchPointerofObject(1, rcvrOop);
	predicatesOop = interpreterProxy.fetchPointerofObject(0, rcvrOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(predicatesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(valuesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	values = valuesOop.words;
	predicates = predicatesOop.bytes;
	for (i = 0; i <= (SIZEOF(valuesOop) - 1); i++) {
		if (predicates[i] === 1) {
			values[i] = val;
		}
	}
	interpreterProxy.pop(1);
}

function primitivePredicateAtAllPutNumber() {
	var i;
	var predicates;
	var predicatesOop;
	var rcvrOop;
	var val;
	var values;
	var valuesOop;

	/* inline: true */;
	val = interpreterProxy.stackFloatValue(0);
	rcvrOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	valuesOop = interpreterProxy.fetchPointerofObject(1, rcvrOop);
	predicatesOop = interpreterProxy.fetchPointerofObject(0, rcvrOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(predicatesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(valuesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	values = valuesOop.wordsAsFloat32Array();
	predicates = predicatesOop.bytes;
	for (i = 0; i <= (SIZEOF(valuesOop) - 1); i++) {
		if (predicates[i] === 1) {
			values[i] = val;
		}
	}
	interpreterProxy.pop(1);
}

function primitivePredicateAtAllPutObject() {
	var i;
	var predicates;
	var predicatesOop;
	var rcvrOop;
	var valOop;
	var values;
	var valuesOop;

	/* inline: true */;
	valOop = interpreterProxy.stackValue(0);
	rcvrOop = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	valuesOop = interpreterProxy.fetchPointerofObject(1, rcvrOop);
	predicatesOop = interpreterProxy.fetchPointerofObject(0, rcvrOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(predicatesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isPointers(valuesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	values = valuesOop.wordsAsInt32Array();
	predicates = predicatesOop.bytes;
	for (i = 0; i <= (SIZEOF(valuesOop) - 1); i++) {
		if (predicates[i] === 1) {
			values[i] = valOop;
		}
	}
	interpreterProxy.pop(1);
}

function primitivePredicateReplaceBytes() {
	var i;
	var predicates;
	var predicatesOop;
	var predicatesSize;
	var rcvrOop;
	var repOop;
	var repStart;
	var replacement;
	var replacementSize;
	var start;
	var stop;
	var values;
	var valuesOop;
	var valuesSize;

	/* inline: true */;
	repStart = interpreterProxy.stackIntegerValue(0);
	repOop = interpreterProxy.stackObjectValue(1);
	stop = interpreterProxy.stackIntegerValue(2);
	start = interpreterProxy.stackIntegerValue(3);
	rcvrOop = interpreterProxy.stackObjectValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	valuesOop = interpreterProxy.fetchPointerofObject(1, rcvrOop);
	predicatesOop = interpreterProxy.fetchPointerofObject(0, rcvrOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(predicatesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!(interpreterProxy.isBytes(valuesOop) && (interpreterProxy.isBytes(repOop)))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	values = valuesOop.bytes;
	predicates = predicatesOop.bytes;
	replacement = repOop.bytes;
	valuesSize = SIZEOF(valuesOop);
	predicatesSize = SIZEOF(predicatesOop);
	replacementSize = SIZEOF(repOop);
	if (start > stop) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (start < 1) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (start > valuesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (start > predicatesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (stop > valuesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (stop > predicatesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (repStart < 1) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (repStart > replacementSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (((replacementSize - repStart) + 1) < ((stop - start) + 1)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	for (i = (start - 1); i <= (stop - 1); i++) {
		if (predicates[i] === 1) {
			values[i] = replacement[(repStart + i) - start];
		}
	}
	interpreterProxy.pop(4);
}

function primitivePredicateReplaceWords() {
	var floatReplacement;
	var floatValues;
	var fv;
	var i;
	var predicates;
	var predicatesOop;
	var predicatesSize;
	var rIsFloat;
	var rcvrOop;
	var repOop;
	var repStart;
	var replacement;
	var replacementSize;
	var start;
	var stop;
	var vIsFloat;
	var values;
	var valuesOop;
	var valuesSize;

	/* inline: true */;
	repStart = interpreterProxy.stackIntegerValue(0);
	repOop = interpreterProxy.stackObjectValue(1);
	stop = interpreterProxy.stackIntegerValue(2);
	start = interpreterProxy.stackIntegerValue(3);
	rcvrOop = interpreterProxy.stackObjectValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	valuesOop = interpreterProxy.fetchPointerofObject(1, rcvrOop);
	predicatesOop = interpreterProxy.fetchPointerofObject(0, rcvrOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(predicatesOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!((interpreterProxy.isWords(valuesOop) && (interpreterProxy.isWords(repOop))) || (interpreterProxy.isPointers(valuesOop) && (interpreterProxy.isPointers(repOop))))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	predicates = predicatesOop.bytes;
	valuesSize = SIZEOF(valuesOop);
	predicatesSize = SIZEOF(predicatesOop);
	replacementSize = SIZEOF(repOop);
	if (start > stop) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (start < 1) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (start > valuesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (start > predicatesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (stop > valuesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (stop > predicatesSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (repStart < 1) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (repStart > replacementSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (((replacementSize - repStart) + 1) < ((stop - start) + 1)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	vIsFloat = interpreterProxy.isMemberOf(valuesOop, "KedamaFloatArray");
	rIsFloat = interpreterProxy.isMemberOf(repOop, "KedamaFloatArray");
	if (vIsFloat && (rIsFloat)) {
		floatValues = valuesOop.wordsAsFloat32Array();
		floatReplacement = repOop.wordsAsFloat32Array();
		for (i = (start - 1); i <= (stop - 1); i++) {
			if (predicates[i] === 1) {
				floatValues[i] = floatReplacement[(repStart + i) - start];
			}
		}
	}
	if (vIsFloat && (!rIsFloat)) {
		floatValues = valuesOop.wordsAsFloat32Array();
		replacement = repOop.words;
		for (i = (start - 1); i <= (stop - 1); i++) {
			if (predicates[i] === 1) {
				floatValues[i] = replacement[(repStart + i) - start];
			}
		}
	}
	if (!vIsFloat && (rIsFloat)) {
		values = valuesOop.words;
		floatReplacement = repOop.wordsAsFloat32Array();
		for (i = (start - 1); i <= (stop - 1); i++) {
			if (predicates[i] === 1) {
				fv = (floatReplacement[(repStart + i) - start]|0);
				;
				values[i] = fv;
			}
		}
	}
	if (!vIsFloat && (!rIsFloat)) {
		values = valuesOop.words;
		replacement = repOop.words;
		for (i = (start - 1); i <= (stop - 1); i++) {
			if (predicates[i] === 1) {
				values[i] = replacement[(repStart + i) - start];
			}
		}
	}
	interpreterProxy.pop(4);
}

function primitiveRemArrays() {
	var argOop;
	var floatArg;
	var floatRcvr;
	var floatResult;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordArg;
	var wordRcvr;
	var wordResult;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordRcvr = wordsRcvr[i];
				wordArg = wordsArg[i];

				/* In this primitive, words are supposed to be unsigned. */

				wordResult = MOD(wordRcvr, wordArg);
				wordsResult[i] = wordResult;
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				wordRcvr = wordsRcvr[i];
				floatArg = floatsArg[i];
				floatResult = wordRcvr / floatArg;
				floatResult = Math.floor(floatResult);
				floatsResult[i] = (wordRcvr - (floatResult * floatArg));
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatRcvr = floatsRcvr[i];
				wordArg = wordsArg[i];
				floatResult = floatRcvr / wordArg;
				floatResult = Math.floor(floatResult);
				floatsResult[i] = (floatRcvr - (floatResult * wordArg));
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatRcvr = floatsRcvr[i];
				floatArg = floatsArg[i];
				floatResult = floatRcvr / floatArg;
				floatResult = Math.floor(floatResult);
				floatsResult[i] = (floatRcvr - (floatResult * floatArg));
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveRemScalar() {
	var argOop;
	var floatArg;
	var floatRcvr;
	var floatResult;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordRcvr;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (MOD(wordsRcvr[i], intArg));
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				wordRcvr = wordsRcvr[i];
				floatResult = wordRcvr / floatArg;
				floatResult = Math.floor(floatResult);
				floatsResult[i] = (wordRcvr - (floatResult * floatArg));
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatRcvr = floatsRcvr[i];
				floatResult = floatRcvr / intArg;
				floatResult = Math.floor(floatResult);
				floatsResult[i] = (floatRcvr - (floatResult * intArg));
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatRcvr = floatsRcvr[i];
				floatResult = floatRcvr / floatArg;
				floatResult = Math.floor(floatResult);
				floatsResult[i] = (floatRcvr - (floatResult * floatArg));
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveSubArrays() {
	var argOop;
	var floatsArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var isArgWords;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsArg;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackObjectValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(argOop));
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(argOop);
	interpreterProxy.success(length === SIZEOF(rcvrOop));
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgWords = interpreterProxy.isMemberOf(argOop, "WordArray");
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgWords && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgWords) {
			wordsRcvr = rcvrOop.words;
			wordsArg = argOop.words;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] - wordsArg[i]);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] - floatsArg[i]);
			}
		}
	} else {
		if (isArgWords) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			wordsArg = argOop.words;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - wordsArg[i]);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatsArg = argOop.wordsAsFloat32Array();
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - floatsArg[i]);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function primitiveSubScalar() {
	var argOop;
	var floatArg;
	var floatsRcvr;
	var floatsResult;
	var i;
	var intArg;
	var isArgInt;
	var isRcvrWords;
	var length;
	var rcvrOop;
	var resultOop;
	var wordsRcvr;
	var wordsResult;

	/* inline: true */;
	resultOop = interpreterProxy.stackObjectValue(0);
	argOop = interpreterProxy.stackValue(1);
	rcvrOop = interpreterProxy.stackObjectValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.success(interpreterProxy.isWords(rcvrOop));
	interpreterProxy.success(interpreterProxy.isWords(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	length = SIZEOF(rcvrOop);
	interpreterProxy.success(length === SIZEOF(resultOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	isArgInt = typeof argOop === "number";
	isRcvrWords = interpreterProxy.isMemberOf(rcvrOop, "WordArray");
	if (isArgInt && isRcvrWords) {
		if (!interpreterProxy.isMemberOf(resultOop, "WordArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (!interpreterProxy.isMemberOf(resultOop, "KedamaFloatArray")) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	if (isRcvrWords) {
		if (isArgInt) {
			wordsRcvr = rcvrOop.words;
			intArg = argOop;
			wordsResult = resultOop.words;
			for (i = 0; i <= (length - 1); i++) {
				wordsResult[i] = (wordsRcvr[i] - intArg);
			}
		} else {
			wordsRcvr = rcvrOop.words;
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (wordsRcvr[i] - floatArg);
			}
		}
	} else {
		if (isArgInt) {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			intArg = argOop;
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - intArg);
			}
		} else {
			floatsRcvr = rcvrOop.wordsAsFloat32Array();
			floatArg = interpreterProxy.floatValueOf(argOop);
			floatsResult = resultOop.wordsAsFloat32Array();
			for (i = 0; i <= (length - 1); i++) {
				floatsResult[i] = (floatsRcvr[i] - floatArg);
			}
		}
	}
	interpreterProxy.pop(4);
	interpreterProxy.push(resultOop);
}

function radiansToDegrees(radians) {
	var deg;
	var degrees;

	/* inline: true */;
	degrees = radians / 0.0174532925199433;
	deg = 90.0 - degrees;
	if (!(deg > 0.0)) {
		deg += 360.0;
	}
	return deg;
}

function randomIntoFloatArray() {
	var factor;
	var floatArray;
	var floatArrayOop;
	var from;
	var index;
	var range;
	var size;
	var to;

	/* inline: true */;
	factor = interpreterProxy.stackFloatValue(0);
	floatArrayOop = interpreterProxy.stackValue(1);
	to = interpreterProxy.stackIntegerValue(2);
	from = interpreterProxy.stackIntegerValue(3);
	range = interpreterProxy.stackIntegerValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(floatArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(floatArrayOop);
	if (!((size >= to) && ((from >= 1) && (to >= from)))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	floatArray = floatArrayOop.wordsAsFloat32Array();
	if (interpreterProxy.failed()) {
		return null;
	}
	for (index = from; index <= to; index++) {
		floatArray[index - 1] = (kedamaRandom2(range) * factor);
	}
	interpreterProxy.pop(5);
}

function randomIntoIntegerArray() {
	var factor;
	var from;
	var index;
	var integerArray;
	var integerArrayOop;
	var range;
	var size;
	var to;

	/* inline: true */;
	factor = interpreterProxy.stackFloatValue(0);
	integerArrayOop = interpreterProxy.stackValue(1);
	to = interpreterProxy.stackIntegerValue(2);
	from = interpreterProxy.stackIntegerValue(3);
	range = interpreterProxy.stackIntegerValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(integerArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(integerArrayOop);
	if (!((size >= to) && ((from >= 1) && (to >= from)))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	integerArray = integerArrayOop.words;
	if (interpreterProxy.failed()) {
		return null;
	}
	for (index = from; index <= to; index++) {
		integerArray[index - 1] = ((kedamaRandom2(range) * factor)|0);
	}
	interpreterProxy.pop(5);
}

function randomRange() {
	var range;
	var ret;

	/* inline: true */;
	range = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	ret = kedamaRandom2(range);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(2);
	interpreterProxy.pushInteger(ret);
}

function scalarGetAngleTo() {
	var fromX;
	var fromY;
	var r;
	var toX;
	var toY;
	var x;
	var y;

	/* inline: true */;
	fromY = interpreterProxy.stackFloatValue(0);
	fromX = interpreterProxy.stackFloatValue(1);
	toY = interpreterProxy.stackFloatValue(2);
	toX = interpreterProxy.stackFloatValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	x = toX - fromX;
	y = toY - fromY;
	r = degreesFromXy(x, y);
	r += 90.0;
	if (r > 360.0) {
		r -= 360.0;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(5);
	interpreterProxy.pushFloat(r);
}

function scalarGetDistanceTo() {
	var fromX;
	var fromY;
	var r;
	var toX;
	var toY;
	var x;
	var y;

	/* inline: true */;
	fromY = interpreterProxy.stackFloatValue(0);
	fromX = interpreterProxy.stackFloatValue(1);
	toY = interpreterProxy.stackFloatValue(2);
	toX = interpreterProxy.stackFloatValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	x = fromX - toX;
	y = fromY - toY;
	r = Math.sqrt((x * x) + (y * y));
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(5);
	interpreterProxy.pushFloat(r);
}

function scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(index, xArray, headingArray, val, destWidth, leftEdgeMode, rightEdgeMode) {
	var headingRadians;
	var newX;

	/* inline: true */;
	newX = val;
	if (newX < 0.0) {
		if (leftEdgeMode === 1) {

			/* wrap */

			newX += destWidth;
		}
		if (leftEdgeMode === 2) {

			/* stick */

			newX = 0.0;
		}
		if (leftEdgeMode === 3) {

			/* bounce */

			newX = 0.0 - newX;
			headingRadians = headingArray[index];
			if (headingRadians < 3.141592653589793) {
				headingArray[index] = (3.141592653589793 - headingRadians);
			} else {
				headingArray[index] = (9.42477796076938 - headingRadians);
			}
		}
	}
	if (newX >= destWidth) {
		if (rightEdgeMode === 1) {
			newX -= destWidth;
		}
		if (rightEdgeMode === 2) {
			newX = destWidth - 1.0e-6;
		}
		if (rightEdgeMode === 3) {
			newX = (destWidth - 1.0e-6) - (newX - destWidth);
			headingRadians = headingArray[index];
			if (headingRadians < 3.141592653589793) {
				headingArray[index] = (3.141592653589793 - headingRadians);
			} else {
				headingArray[index] = (9.42477796076938 - headingRadians);
			}
		}
	}
	xArray[index] = newX;
}

function scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(index, yArray, headingArray, val, destHeight, topEdgeMode, bottomEdgeMode) {
	var newY;

	/* inline: true */;
	newY = val;
	if (newY < 0.0) {
		if (topEdgeMode === 1) {

			/* wrap */

			newY += destHeight;
		}
		if (topEdgeMode === 2) {

			/* stick */

			newY = 0.0;
		}
		if (topEdgeMode === 3) {

			/* bounce */

			newY = 0.0 - newY;
			headingArray[index] = (6.283185307179586 - headingArray[index]);
		}
	}
	if (newY >= destHeight) {
		if (bottomEdgeMode === 1) {
			newY -= destHeight;
		}
		if (bottomEdgeMode === 2) {
			newY = destHeight - 1.0e-6;
		}
		if (bottomEdgeMode === 3) {
			newY = (destHeight - 1.0e-6) - (newY - destHeight);
			headingArray[index] = (6.283185307179586 - headingArray[index]);
		}
	}
	yArray[index] = newY;
}

function setHeadingArrayFrom() {
	var heading;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var pArray;
	var pOop;
	var resultArray;
	var resultOop;
	var size;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	headingOop = interpreterProxy.stackValue(1);
	pOop = interpreterProxy.stackValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(pOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(headingOop);
	if (resultOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(resultOop)) {
			if (SIZEOF(resultOop) !== size) {
				interpreterProxy.primitiveFail();
				return null;
			}
			isValVector = true;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	pArray = pOop.bytes;
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		resultArray = resultOop.wordsAsFloat32Array();
	} else {
		heading = interpreterProxy.floatValueOf(resultOop);
		heading = degreesToRadians(heading);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (pArray[i] === 1) {
			if (isValVector) {
				heading = resultArray[i];
				heading = degreesToRadians(heading);
			}
			headingArray[i] = heading;
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(3);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}

function setScalarHeading() {
	var heading;
	var headingArray;
	var headingOop;
	var index;

	/* inline: true */;
	heading = interpreterProxy.stackFloatValue(0);
	headingOop = interpreterProxy.stackValue(1);
	index = interpreterProxy.stackIntegerValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) < index) {
		interpreterProxy.primitiveFail();
		return null;
	}
	headingArray = headingOop.wordsAsFloat32Array();
	headingArray[index - 1] = degreesToRadians(heading);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(3);
}

function shutdownModule() {
	return true;
}

function turtleScalarSetX() {
	var destWidth;
	var headingArray;
	var headingOop;
	var leftEdgeMode;
	var rightEdgeMode;
	var size;
	var val;
	var xArray;
	var xIndex;
	var xOop;

	/* inline: true */;
	rightEdgeMode = interpreterProxy.stackIntegerValue(0);
	leftEdgeMode = interpreterProxy.stackIntegerValue(1);
	destWidth = interpreterProxy.stackFloatValue(2);
	val = interpreterProxy.stackFloatValue(3);
	headingOop = interpreterProxy.stackValue(4);
	xIndex = interpreterProxy.stackIntegerValue(5);
	xOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(xOop);
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	xArray = xOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(xIndex - 1, xArray, headingArray, val, destWidth, leftEdgeMode, rightEdgeMode);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function turtleScalarSetY() {
	var bottomEdgeMode;
	var destHeight;
	var headingArray;
	var headingOop;
	var size;
	var topEdgeMode;
	var val;
	var yArray;
	var yIndex;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	destHeight = interpreterProxy.stackFloatValue(2);
	val = interpreterProxy.stackFloatValue(3);
	headingOop = interpreterProxy.stackValue(4);
	yIndex = interpreterProxy.stackIntegerValue(5);
	yOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(yOop);
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(yIndex - 1, yArray, headingArray, val, destHeight, topEdgeMode, bottomEdgeMode);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function turtlesSetX() {
	var destWidth;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var isWordVector;
	var leftEdgeMode;
	var newX;
	var pArray;
	var pOop;
	var rightEdgeMode;
	var size;
	var val;
	var valArray;
	var valOop;
	var wordValArray;
	var xArray;
	var xOop;

	/* inline: true */;
	rightEdgeMode = interpreterProxy.stackIntegerValue(0);
	leftEdgeMode = interpreterProxy.stackIntegerValue(1);
	destWidth = interpreterProxy.stackFloatValue(2);
	valOop = interpreterProxy.stackValue(3);
	headingOop = interpreterProxy.stackValue(4);
	xOop = interpreterProxy.stackValue(5);
	pOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(pOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (valOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(valOop)) {
			isValVector = true;
			isWordVector = interpreterProxy.isMemberOf(valOop, "WordArray");
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	size = SIZEOF(xOop);
	if (SIZEOF(pOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (isValVector) {
		if (SIZEOF(valOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	pArray = pOop.bytes;
	xArray = xOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		if (isWordVector) {
			wordValArray = valOop.words;
		} else {
			valArray = valOop.wordsAsFloat32Array();
		}
	} else {
		val = interpreterProxy.floatValueOf(valOop);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (pArray[i] === 1) {
			if (isValVector) {
				if (isWordVector) {
					newX = wordValArray[i];
					;
				} else {
					newX = valArray[i];
				}
			} else {
				newX = val;
			}
			scalarXAtxArrayheadingArrayvaluedestWidthleftEdgeModerightEdgeMode(i, xArray, headingArray, newX, destWidth, leftEdgeMode, rightEdgeMode);
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function turtlesSetY() {
	var bottomEdgeMode;
	var destHeight;
	var headingArray;
	var headingOop;
	var i;
	var isValVector;
	var isWordVector;
	var newY;
	var pArray;
	var pOop;
	var size;
	var topEdgeMode;
	var val;
	var valArray;
	var valOop;
	var wordValArray;
	var yArray;
	var yOop;

	/* inline: true */;
	bottomEdgeMode = interpreterProxy.stackIntegerValue(0);
	topEdgeMode = interpreterProxy.stackIntegerValue(1);
	destHeight = interpreterProxy.stackFloatValue(2);
	valOop = interpreterProxy.stackValue(3);
	headingOop = interpreterProxy.stackValue(4);
	yOop = interpreterProxy.stackValue(5);
	pOop = interpreterProxy.stackValue(6);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isBytes(pOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(headingOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (valOop.isFloat) {
		isValVector = false;
	} else {
		if (interpreterProxy.isWords(valOop)) {
			isValVector = true;
			isWordVector = interpreterProxy.isMemberOf(valOop, "WordArray");
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	size = SIZEOF(yOop);
	if (SIZEOF(pOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(headingOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (isValVector) {
		if (SIZEOF(valOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	pArray = pOop.bytes;
	yArray = yOop.wordsAsFloat32Array();
	headingArray = headingOop.wordsAsFloat32Array();
	if (isValVector) {
		if (isWordVector) {
			wordValArray = valOop.words;
		} else {
			valArray = valOop.wordsAsFloat32Array();
		}
	} else {
		val = interpreterProxy.floatValueOf(valOop);
	}
	for (i = 0; i <= (size - 1); i++) {
		if (pArray[i] === 1) {
			if (isValVector) {
				if (isWordVector) {
					newY = wordValArray[i];
					;
				} else {
					newY = valArray[i];
				}
			} else {
				newY = val;
			}
			scalarYAtyArrayheadingArrayvaluedestHeighttopEdgeModebottomEdgeMode(i, yArray, headingArray, newY, destHeight, topEdgeMode, bottomEdgeMode);
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(7);
}

function vectorGetAngleTo() {
	var index;
	var isVector;
	var pX;
	var pXOop;
	var pY;
	var pYOop;
	var ppx;
	var ppy;
	var r;
	var result;
	var resultOop;
	var size;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	yArrayOop = interpreterProxy.stackValue(1);
	xArrayOop = interpreterProxy.stackValue(2);
	pYOop = interpreterProxy.stackValue(3);
	pXOop = interpreterProxy.stackValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(resultOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(resultOop);
	if (size < 0) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(xArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (pXOop.isFloat) {
		if (pYOop.isFloat) {
			isVector = false;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (pYOop.isFloat) {
			interpreterProxy.primitiveFail();
			return null;
		} else {
			isVector = true;
		}
	}
	if (isVector) {
		if (SIZEOF(pXOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
		if (SIZEOF(pYOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	result = resultOop.wordsAsFloat32Array();
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	if (isVector) {
		pX = pXOop.wordsAsFloat32Array();
		pY = pYOop.wordsAsFloat32Array();
	}
	if (!isVector) {
		ppx = interpreterProxy.floatValueOf(pXOop);
		ppy = interpreterProxy.floatValueOf(pYOop);
	}
	for (index = 0; index <= (size - 1); index++) {
		if (isVector) {
			ppx = pX[index];
			ppy = pY[index];
		}
		x = ppx - xArray[index];
		y = ppy - yArray[index];
		r = degreesFromXy(x, y);
		r += 90.0;
		if (r > 360.0) {
			r -= 360.0;
		}
		result[index] = r;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
	interpreterProxy.push(resultOop);
}

function vectorGetDistanceTo() {
	var index;
	var isVector;
	var pX;
	var pXOop;
	var pY;
	var pYOop;
	var ppx;
	var ppy;
	var result;
	var resultOop;
	var size;
	var x;
	var xArray;
	var xArrayOop;
	var y;
	var yArray;
	var yArrayOop;

	/* inline: true */;
	resultOop = interpreterProxy.stackValue(0);
	yArrayOop = interpreterProxy.stackValue(1);
	xArrayOop = interpreterProxy.stackValue(2);
	pYOop = interpreterProxy.stackValue(3);
	pXOop = interpreterProxy.stackValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(resultOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(xArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!interpreterProxy.isWords(yArrayOop)) {
		interpreterProxy.primitiveFail();
		return null;
	}
	size = SIZEOF(resultOop);
	if (size < 0) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(xArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (SIZEOF(yArrayOop) !== size) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (pXOop.isFloat) {
		if (pYOop.isFloat) {
			isVector = false;
		} else {
			interpreterProxy.primitiveFail();
			return null;
		}
	} else {
		if (pYOop.isFloat) {
			interpreterProxy.primitiveFail();
			return null;
		} else {
			isVector = true;
		}
	}
	if (isVector) {
		if (SIZEOF(pXOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
		if (SIZEOF(pYOop) !== size) {
			interpreterProxy.primitiveFail();
			return null;
		}
	}
	result = resultOop.wordsAsFloat32Array();
	xArray = xArrayOop.wordsAsFloat32Array();
	yArray = yArrayOop.wordsAsFloat32Array();
	if (isVector) {
		pX = pXOop.wordsAsFloat32Array();
		pY = pYOop.wordsAsFloat32Array();
	}
	if (!isVector) {
		ppx = interpreterProxy.floatValueOf(pXOop);
		ppy = interpreterProxy.floatValueOf(pYOop);
	}
	for (index = 0; index <= (size - 1); index++) {
		if (isVector) {
			ppx = pX[index];
			ppy = pY[index];
		}
		x = ppx - xArray[index];
		y = ppy - yArray[index];
		result[index] = Math.sqrt((x * x) + (y * y));
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(6);
	interpreterProxy.push(resultOop);
}

function zoomBitmap() {
	var bit;
	var dOrigin;
	var dst;
	var dstIndex;
	var dstSize;
	var dummy;
	var sHeight;
	var sOrigin;
	var sWidth;
	var src;
	var srcIndex;
	var srcOrigin;
	var srcSize;
	var sx;
	var sy;
	var xFactor;
	var y;
	var yFactor;

	/* inline: true */;
	yFactor = interpreterProxy.stackIntegerValue(0);
	xFactor = interpreterProxy.stackIntegerValue(1);
	sHeight = interpreterProxy.stackIntegerValue(2);
	sWidth = interpreterProxy.stackIntegerValue(3);
	dst = interpreterProxy.stackValue(4);
	src = interpreterProxy.stackValue(5);
	if (interpreterProxy.failed()) {
		return null;
	}
	srcSize = SIZEOF(src);
	dstSize = SIZEOF(dst);
	if ((sWidth * sHeight) !== srcSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	if (((srcSize * xFactor) * yFactor) !== dstSize) {
		interpreterProxy.primitiveFail();
		return null;
	}
	sOrigin = src.words;
	dOrigin = dst.words;
	srcIndex = 0;
	srcOrigin = 0;
	dstIndex = 0;
	for (sy = 0; sy <= (sHeight - 1); sy++) {
		for (y = 0; y <= (yFactor - 1); y++) {
			for (sx = 0; sx <= (sWidth - 1); sx++) {
				bit = sOrigin[srcIndex];
				++srcIndex;
				for (dummy = 0; dummy <= (xFactor - 1); dummy++) {
					dOrigin[dstIndex] = bit;
					++dstIndex;
				}
			}
			srcIndex = srcOrigin;
		}
		srcOrigin += sWidth;
		srcIndex = srcOrigin;
	}
	interpreterProxy.pop(6);
}


Squeak.registerExternalModule("KedamaPlugin2", {
	primitiveAddArrays: primitiveAddArrays,
	getModuleName: getModuleName,
	primitiveMulArrays: primitiveMulArrays,
	drawTurtlesInArray: drawTurtlesInArray,
	primitiveGTScalar: primitiveGTScalar,
	setScalarHeading: setScalarHeading,
	primitiveSubScalar: primitiveSubScalar,
	turtleScalarSetY: turtleScalarSetY,
	vectorGetAngleTo: vectorGetAngleTo,
	primitiveRemArrays: primitiveRemArrays,
	primitiveLTArrays: primitiveLTArrays,
	primitiveAddScalar: primitiveAddScalar,
	primPixelsAtXY: primPixelsAtXY,
	primitiveMulScalar: primitiveMulScalar,
	primSetPixelsAtXY: primSetPixelsAtXY,
	setHeadingArrayFrom: setHeadingArrayFrom,
	primPixelAtXYPut: primPixelAtXYPut,
	makeMaskLog: makeMaskLog,
	primitiveLTScalar: primitiveLTScalar,
	scalarGetAngleTo: scalarGetAngleTo,
	primitiveOrByteArray: primitiveOrByteArray,
	primitiveLEArrays: primitiveLEArrays,
	primitiveRemScalar: primitiveRemScalar,
	getHeadingArrayInto: getHeadingArrayInto,
	turtlesSetX: turtlesSetX,
	primitivePredicateReplaceBytes: primitivePredicateReplaceBytes,
	primitiveDivArrays: primitiveDivArrays,
	makeMask: makeMask,
	primitiveLEScalar: primitiveLEScalar,
	kedamaSetRandomSeed: kedamaSetRandomSeed,
	randomIntoIntegerArray: randomIntoIntegerArray,
	setInterpreter: setInterpreter,
	primitivePredicateAtAllPutColor: primitivePredicateAtAllPutColor,
	makeTurtlesMap: makeTurtlesMap,
	randomIntoFloatArray: randomIntoFloatArray,
	primUpHill: primUpHill,
	shutdownModule: shutdownModule,
	primitiveDivScalar: primitiveDivScalar,
	primitiveGEArrays: primitiveGEArrays,
	primitiveNotByteArray: primitiveNotByteArray,
	randomRange: randomRange,
	initialiseModule: initialiseModule,
	getScalarHeading: getScalarHeading,
	primPixelAtXY: primPixelAtXY,
	primitivePredicateAtAllPutNumber: primitivePredicateAtAllPutNumber,
	primitiveEQArrays: primitiveEQArrays,
	primitiveNEArrays: primitiveNEArrays,
	primScalarForward: primScalarForward,
	vectorGetDistanceTo: vectorGetDistanceTo,
	turtlesSetY: turtlesSetY,
	turtleScalarSetX: turtleScalarSetX,
	primTurtlesForward: primTurtlesForward,
	primitiveGEScalar: primitiveGEScalar,
	primitiveAndByteArray: primitiveAndByteArray,
	primitivePredicateReplaceWords: primitivePredicateReplaceWords,
	primitiveGTArrays: primitiveGTArrays,
	primitivePredicateAtAllPutObject: primitivePredicateAtAllPutObject,
	primitiveEQScalar: primitiveEQScalar,
	primitivePredicateAtAllPutBoolean: primitivePredicateAtAllPutBoolean,
	zoomBitmap: zoomBitmap,
	primitiveNEScalar: primitiveNEScalar,
	scalarGetDistanceTo: scalarGetDistanceTo,
	primitiveSubArrays: primitiveSubArrays,
});

}); // end of module

/***** including ../plugins/Klatt.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:21 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	KlattSynthesizerPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.Klatt").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Constants ***/
var A1v = 46;
var A2f = 34;
var A2v = 47;
var A3f = 35;
var A3v = 48;
var A4f = 36;
var A4v = 49;
var A5f = 37;
var A6f = 38;
var Anv = 45;
var Aspiration = 9;
var Atv = 50;
var B1 = 13;
var B2 = 17;
var B2f = 40;
var B3 = 19;
var B3f = 41;
var B4 = 21;
var B4f = 42;
var B5 = 23;
var B5f = 43;
var B6 = 25;
var B6f = 44;
var Bnp = 27;
var Bnz = 29;
var Btp = 31;
var Btz = 33;
var Bypass = 39;
var Diplophonia = 4;
var Epsilon = 0.0001;
var F0 = 0;
var F1 = 12;
var F2 = 16;
var F3 = 18;
var F4 = 20;
var F5 = 22;
var F6 = 24;
var Flutter = 1;
var Fnp = 26;
var Fnz = 28;
var Friction = 10;
var Ftp = 30;
var Ftz = 32;
var Gain = 51;
var Jitter = 2;
var PI = 3.141592653589793;
var R1c = 12;
var R1vp = 3;
var R2c = 13;
var R2fp = 7;
var R2vp = 4;
var R3c = 14;
var R3fp = 8;
var R3vp = 5;
var R4c = 15;
var R4fp = 9;
var R4vp = 6;
var R5c = 16;
var R5fp = 10;
var R6c = 17;
var R6fp = 11;
var R7c = 18;
var R8c = 19;
var Ra = 7;
var Rk = 8;
var Rnpc = 20;
var Rnpp = 1;
var Rnz = 21;
var Ro = 6;
var Rout = 24;
var Rtpc = 22;
var Rtpp = 2;
var Rtz = 23;
var Shimmer = 3;
var Turbulence = 11;
var Voicing = 5;

/*** Variables ***/
var a1 = 0;
var a2 = 0;
var b1 = 0;
var c1 = 0;
var cascade = 0;
var frame = null;
var glast = 0;
var interpreterProxy = null;
var moduleName = "Klatt 3 November 2014 (e)";
var nlast = 0;
var nmod = 0;
var nopen = 0;
var nper = 0;
var periodCount = 0;
var pitch = 0;
var resonators = null;
var samplesCount = 0;
var samplesPerFrame = 0;
var samplingRate = 0;
var seed = 0;
var t0 = 0;
var vlast = 0;
var x1 = 0;
var x2 = 0;



/*	Add diplophonia (bicyclic voice). Change voicing amplitude. */

function addAmplitudeDiplophonia() {
	if ((MOD(periodCount, 2)) !== 0) {

		/* x1 must be <= 0 */

		x1 = x1 * (1.0 - frame[Diplophonia]);
		if (x1 > 0) {
			x1 = 0;
		}
	}
}


/*	Add F0 flutter, as specified in:
		'Analysis, synthesis and perception of voice quality variations among
		female and male talkers' D.H. Klatt and L.C. Klatt JASA 87(2) February 1990.
	Flutter is added by applying a quasi-random element constructed from three
	slowly varying sine waves. */

function addFlutter() {
	var asin;
	var bsin;
	var csin;
	var deltaF0;
	var timeCount;

	timeCount = samplesCount / samplingRate;
	asin = Math.sin(((2.0 * PI) * 12.7) * timeCount);
	bsin = Math.sin(((2.0 * PI) * 7.1) * timeCount);
	csin = Math.sin(((2.0 * PI) * 4.7) * timeCount);
	deltaF0 = (((frame[Flutter] * 2.0) * frame[F0]) / 100.0) * ((asin + bsin) + csin);
	pitch += deltaF0;
}


/*	Add diplophonia (bicyclic voice). Change F0. */

function addFrequencyDiplophonia() {
	if ((MOD(periodCount, 2)) === 0) {
		pitch += (frame[Diplophonia] * frame[F0]) * (1.0 - frame[Ro]);
	} else {
		pitch -= (frame[Diplophonia] * frame[F0]) * (1.0 - frame[Ro]);
	}
}


/*	Add jitter (random F0 perturbation). */

function addJitter() {
	pitch += (((nextRandom() - 32767) * frame[Jitter]) / 32768.0) * frame[F0];
}


/*	Add shimmer (random voicing amplitude perturbation). */

function addShimmer() {

	/* x1 must be <= 0 */

	x1 += (((nextRandom() - 32767) * frame[Shimmer]) / 32768.0) * x1;
	if (x1 > 0) {
		x1 = 0;
	}
}


/*	Set up an anti-resonator */

function antiResonatorfrequencybandwidth(index, freq, bw) {
	var a;
	var arg;
	var b;
	var c;
	var r;

	arg = ((0.0 - PI) / samplingRate) * bw;
	r = Math.exp(arg);
	c = 0.0 - (r * r);
	arg = ((PI * 2.0) / samplingRate) * freq;
	b = (r * Math.cos(arg)) * 2.0;
	a = (1.0 - b) - c;
	a = 1.0 / a;
	b = (0.0 - b) * a;
	c = (0.0 - c) * a;
	resonatorAput(index, a);
	resonatorBput(index, b);
	resonatorCput(index, c);
}

function antiResonatorvalue(index, aFloat) {
	var answer;
	var p1;

	answer = ((resonatorA(index) * aFloat) + (resonatorB(index) * ((p1 = resonatorP1(index))))) + (resonatorC(index) * resonatorP2(index));
	resonatorP2put(index, p1);
	resonatorP1put(index, aFloat);
	return answer;
}


/*	Cascade vocal tract, excited by laryngeal sources.
	Nasal antiresonator, nasal resonator, tracheal antirresonator,
	tracheal resonator, then formants F8, F7, F6, F5, F4, F3, F2, F1. */

function cascadeBranch(source) {
	var out;

	if (!(cascade > 0)) {
		return 0.0;
	}
	out = antiResonatorvalue(Rnz, source);
	out = resonatorvalue(Rnpc, out);
	out = antiResonatorvalue(Rtz, out);

	/* Do not use unless sample rate >= 16000 */

	out = resonatorvalue(Rtpc, out);
	if (cascade >= 8) {
		out = resonatorvalue(R8c, out);
	}
	if (cascade >= 7) {
		out = resonatorvalue(R7c, out);
	}
	if (cascade >= 6) {
		out = resonatorvalue(R6c, out);
	}
	if (cascade >= 5) {
		out = resonatorvalue(R5c, out);
	}
	if (cascade >= 4) {
		out = resonatorvalue(R4c, out);
	}
	if (cascade >= 3) {
		out = resonatorvalue(R3c, out);
	}
	if (cascade >= 2) {
		out = resonatorvalue(R2c, out);
	}
	if (cascade >= 1) {
		out = resonatorvalue(R1c, out);
	}
	return out;
}


/*	Return the first indexable word of oop which is assumed to be variableWordSubclass */

function checkedFloatPtrOf(oop) {
	interpreterProxy.success(interpreterProxy.isWords(oop));
	if (interpreterProxy.failed()) {
		return 0;
	}
	return oop.wordsAsFloat32Array();
}


/*	Return the first indexable word of oop which is assumed to be variableWordSubclass */

function checkedShortPtrOf(oop) {
	interpreterProxy.success(interpreterProxy.isWords(oop));
	if (interpreterProxy.failed()) {
		return 0;
	}
	return oop.wordsAsInt16Array();
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function glottalSource() {
	var x0;

	if (t0 === 0) {
		return 0;
	}
	if (nper < nopen) {
		x0 = (a1 * x1) + (a2 * x2);
		x2 = x1;
		x1 = x0;
	} else {
		x0 = (b1 * x1) - c1;
		x1 = x0;
	}
	if (nper >= t0) {
		nper = 0;
		pitchSynchronousReset();
	}
	++nper;
	return x0;
}

function halt() {
	;
}

function linearFromdB(aNumber) {
	return Math.pow(2.0,((aNumber - 87.0) / 6.0)) * 32.767;
}

function loadFrom(klattOop) {
	var oop;

	interpreterProxy.success(SIZEOF(klattOop) === 22);
	if (interpreterProxy.failed()) {
		return false;
	}
	oop = interpreterProxy.fetchPointerofObject(0, klattOop);
	resonators = checkedFloatPtrOf(oop);
	pitch = interpreterProxy.fetchFloatofObject(2, klattOop);
	t0 = interpreterProxy.fetchIntegerofObject(3, klattOop);
	nper = interpreterProxy.fetchIntegerofObject(4, klattOop);
	nopen = interpreterProxy.fetchIntegerofObject(5, klattOop);
	nmod = interpreterProxy.fetchIntegerofObject(6, klattOop);
	a1 = interpreterProxy.fetchFloatofObject(7, klattOop);
	a2 = interpreterProxy.fetchFloatofObject(8, klattOop);
	x1 = interpreterProxy.fetchFloatofObject(9, klattOop);
	x2 = interpreterProxy.fetchFloatofObject(10, klattOop);
	b1 = interpreterProxy.fetchFloatofObject(11, klattOop);
	c1 = interpreterProxy.fetchFloatofObject(12, klattOop);
	glast = interpreterProxy.fetchFloatofObject(13, klattOop);
	vlast = interpreterProxy.fetchFloatofObject(14, klattOop);
	nlast = interpreterProxy.fetchFloatofObject(15, klattOop);
	periodCount = interpreterProxy.fetchIntegerofObject(16, klattOop);
	samplesCount = interpreterProxy.fetchIntegerofObject(17, klattOop);
	seed = interpreterProxy.fetchIntegerofObject(18, klattOop);
	cascade = interpreterProxy.fetchIntegerofObject(19, klattOop);
	samplesPerFrame = interpreterProxy.fetchIntegerofObject(20, klattOop);
	samplingRate = interpreterProxy.fetchIntegerofObject(21, klattOop);
	return interpreterProxy.failed() === false;
}


/*	Answer a random number between 0 and 65535. */

function nextRandom() {
	seed = ((seed * 1309) + 13849) & 65535;
	return seed;
}

function normalizeGlottalPulse() {
	var ingore;
	var s0;
	var s1;
	var s2;

	s0 = 0.0;
	s1 = x1;
	s2 = x2;
	for (ingore = 1; ingore <= nopen; ingore++) {
		s0 = (a1 * s1) + (a2 * s2);
		s2 = s1;
		s1 = s0;
	}
	if (s0 !== 0.0) {
		x1 = (x1 / s0) * 10000.0;
	}
}


/*	Friction-excited parallel vocal tract formants F6, F5, F4, F3, F2,
	outputs added with alternating sign. Sound source for other
	parallel resonators is friction plus first difference of
	voicing waveform. */

function parallelFrictionBranch(source) {
	return (((resonatorvalue(R2fp, source) - resonatorvalue(R3fp, source)) + resonatorvalue(R4fp, source)) - resonatorvalue(R5fp, source)) + resonatorvalue(R6fp, source);
}


/*	Voice-excited parallel vocal tract F1, F2, F3, F4, FNP and FTP. */

function parallelVoicedBranch(source) {
	return ((((resonatorvalue(R1vp, source) + resonatorvalue(R2vp, source)) + resonatorvalue(R3vp, source)) + resonatorvalue(R4vp, source)) + resonatorvalue(Rnpp, source)) + resonatorvalue(Rtpp, source);
}

function pitchSynchronousReset() {
	if (frame[F0] > 0) {
		voicedPitchSynchronousReset();
		periodCount = MOD((periodCount + 1), 65535);
	} else {
		t0 = 1;
		nmod = t0;
	}
}

function primitiveSynthesizeFrameIntoStartingAt() {
	var aKlattFrame;
	var buffer;
	var bufferOop;
	var rcvr;
	var startIndex;

	aKlattFrame = checkedFloatPtrOf(interpreterProxy.stackValue(2));
	buffer = checkedShortPtrOf((bufferOop = interpreterProxy.stackValue(1)));
	startIndex = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	rcvr = interpreterProxy.stackObjectValue(3);
	if (!loadFrom(rcvr)) {
		return null;
	}
	interpreterProxy.success((SIZEOF(bufferOop) * 2) >= samplesPerFrame);
	if (interpreterProxy.failed()) {
		return null;
	}
	synthesizeFrameintostartingAt(aKlattFrame, buffer, startIndex);
	if (!saveTo(rcvr)) {
		return null;
	}
	interpreterProxy.pop(3);
}

function quphicosphisinphirphid(u, phi, cosphi, sinphi, rphid) {
	var expuphi;

	expuphi = Math.exp(u * phi);
	return (expuphi * ((((rphid * ((u * u) + 1.0)) + u) * sinphi) - cosphi)) + 1.0;
}


/*	Convert formant frequencies and bandwidth into
	resonator difference equation coefficients. */

function resonatorfrequencybandwidth(index, freq, bw) {
	var a;
	var arg;
	var b;
	var c;
	var r;

	arg = ((0.0 - PI) / samplingRate) * bw;
	r = Math.exp(arg);
	c = 0.0 - (r * r);
	arg = ((PI * 2.0) / samplingRate) * freq;
	b = (r * Math.cos(arg)) * 2.0;
	a = (1.0 - b) - c;
	resonatorAput(index, a);
	resonatorBput(index, b);
	resonatorCput(index, c);
}


/*	Convert formant frequencies and bandwidth into
	resonator difference equation coefficients. */

function resonatorfrequencybandwidthgain(index, freq, bw, gain) {
	resonatorfrequencybandwidth(index, freq, bw);
	resonatorAput(index, resonatorA(index) * gain);
}

function resonatorvalue(index, aFloat) {
	var answer;
	var p1;


	/* (p1 between: -100000 and: 100000) ifFalse: [self halt].
	(answer between: -100000 and: 100000) ifFalse: [self halt]. */

	answer = ((resonatorA(index) * aFloat) + (resonatorB(index) * ((p1 = resonatorP1(index))))) + (resonatorC(index) * resonatorP2(index));
	resonatorP2put(index, p1);
	resonatorP1put(index, answer);
	return answer;
}

function resonatorA(index) {
	return resonators[(index * 5) - 5];
}

function resonatorAput(index, aFloat) {
	resonators[(index * 5) - 5] = aFloat;
}

function resonatorB(index) {
	return resonators[(index * 5) - 4];
}

function resonatorBput(index, aFloat) {
	resonators[(index * 5) - 4] = aFloat;
}

function resonatorC(index) {
	return resonators[(index * 5) - 3];
}

function resonatorCput(index, aFloat) {
	resonators[(index * 5) - 3] = aFloat;
}

function resonatorP1(index) {
	return resonators[(index * 5) - 2];
}

function resonatorP1put(index, aFloat) {
	resonators[(index * 5) - 2] = aFloat;
}

function resonatorP2(index) {
	return resonators[(index * 5) - 1];
}

function resonatorP2put(index, aFloat) {
	resonators[(index * 5) - 1] = aFloat;
}

function rorark(roNumber, raNumber, rkNumber) {
	var cosphi;
	var d;
	var gamma;
	var gammapwr;
	var phi;
	var r;
	var ra;
	var rho;
	var rk;
	var ro;
	var rphid;
	var sinphi;
	var te;
	var theta;
	var u;

	te = ((t0 * roNumber)|0);
	ro = te / t0;
	rk = rkNumber;
	ra = raNumber;
	if (ra <= 0.0) {
		d = 1.0;
	} else {
		r = (1.0 - ro) / ra;
		d = 1.0 - (r / (Math.exp(r) - 1.0));
	}
	phi = PI * (rk + 1.0);
	cosphi = Math.cos(phi);
	sinphi = Math.sin(phi);
	rphid = ((ra / ro) * phi) * d;
	u = zeroQphicosphisinphirphid(phi, cosphi, sinphi, rphid);
	theta = phi / te;
	rho = Math.exp(u * theta);
	a1 = (2.0 * Math.cos(theta)) * rho;
	a2 = 0.0 - (rho * rho);
	x2 = 0.0;
	x1 = rho * Math.sin(theta);
	gamma = Math.exp(-1.0 / (ra * t0));
	gammapwr = Math.pow(gamma,(t0 - te));
	b1 = gamma;
	c1 = ((1.0 - gamma) * gammapwr) / (1.0 - gammapwr);
	normalizeGlottalPulse();
}

function saveTo(origKlattOop) {
	var a1Oop;
	var a2Oop;
	var b1Oop;
	var c1Oop;
	var glastOop;
	var klattOop;
	var nlastOop;
	var pitchOop;
	var vlastOop;
	var x1Oop;
	var x2Oop;

	interpreterProxy.pushRemappableOop(origKlattOop);
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(pitch));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(a1));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(a2));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(x1));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(x2));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(b1));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(c1));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(glast));
	interpreterProxy.pushRemappableOop(interpreterProxy.floatObjectOf(vlast));
	nlastOop = interpreterProxy.floatObjectOf(nlast);
	vlastOop = interpreterProxy.popRemappableOop();
	glastOop = interpreterProxy.popRemappableOop();
	c1Oop = interpreterProxy.popRemappableOop();
	b1Oop = interpreterProxy.popRemappableOop();
	x2Oop = interpreterProxy.popRemappableOop();
	x1Oop = interpreterProxy.popRemappableOop();
	a2Oop = interpreterProxy.popRemappableOop();
	a1Oop = interpreterProxy.popRemappableOop();
	pitchOop = interpreterProxy.popRemappableOop();
	klattOop = interpreterProxy.popRemappableOop();
	if (interpreterProxy.failed()) {
		return false;
	}
	interpreterProxy.storePointerofObjectwithValue(2, klattOop, pitchOop);
	interpreterProxy.storeIntegerofObjectwithValue(3, klattOop, t0);
	interpreterProxy.storeIntegerofObjectwithValue(4, klattOop, nper);
	interpreterProxy.storeIntegerofObjectwithValue(5, klattOop, nopen);
	interpreterProxy.storeIntegerofObjectwithValue(6, klattOop, nmod);
	interpreterProxy.storePointerofObjectwithValue(7, klattOop, a1Oop);
	interpreterProxy.storePointerofObjectwithValue(8, klattOop, a2Oop);
	interpreterProxy.storePointerofObjectwithValue(9, klattOop, x1Oop);
	interpreterProxy.storePointerofObjectwithValue(10, klattOop, x2Oop);
	interpreterProxy.storePointerofObjectwithValue(11, klattOop, b1Oop);
	interpreterProxy.storePointerofObjectwithValue(12, klattOop, c1Oop);
	interpreterProxy.storePointerofObjectwithValue(13, klattOop, glastOop);
	interpreterProxy.storePointerofObjectwithValue(14, klattOop, vlastOop);
	interpreterProxy.storePointerofObjectwithValue(15, klattOop, nlastOop);
	interpreterProxy.storeIntegerofObjectwithValue(16, klattOop, periodCount);
	interpreterProxy.storeIntegerofObjectwithValue(17, klattOop, samplesCount);
	interpreterProxy.storeIntegerofObjectwithValue(18, klattOop, seed);
	return interpreterProxy.failed() === false;
}

function setCurrentFrame(aKlattFrame) {
	var ampF1V;
	var ampF2F;
	var ampF2V;
	var ampF3F;
	var ampF3V;
	var ampF4F;
	var ampF4V;
	var ampF5F;
	var ampF6F;
	var ampFNV;
	var ampFTV;


	/* Fudge factors... */

	frame = aKlattFrame;

	/* -4.44 dB */

	ampFNV = linearFromdB(frame[Anv]) * 0.6;

	/* -4.44 dB */

	ampFTV = linearFromdB(frame[Atv]) * 0.6;

	/* -7.96 dB */

	ampF1V = linearFromdB(frame[A1v]) * 0.4;

	/* -16.5 dB */

	ampF2V = linearFromdB(frame[A2v]) * 0.15;

	/* -24.4 dB */

	ampF3V = linearFromdB(frame[A3v]) * 0.06;

	/* -28.0 dB */

	ampF4V = linearFromdB(frame[A4v]) * 0.04;

	/* -16.5 dB */

	ampF2F = linearFromdB(frame[A2f]) * 0.15;

	/* -24.4 dB */

	ampF3F = linearFromdB(frame[A3f]) * 0.06;

	/* -28.0 dB */

	ampF4F = linearFromdB(frame[A4f]) * 0.04;

	/* -33.2 dB */

	ampF5F = linearFromdB(frame[A5f]) * 0.022;

	/* -30.5 dB */
	/* Set coefficients of variable cascade resonators */

	ampF6F = linearFromdB(frame[A6f]) * 0.03;
	if (cascade >= 8) {
		if (samplingRate >= 16000) {

			/* Inside Nyquist rate? */

			resonatorfrequencybandwidth(R8c, 7500, 600);
		} else {
			cascade = 6;
		}
	}
	if (cascade >= 7) {
		if (samplingRate >= 16000) {

			/* Inside Nyquist rate? */

			resonatorfrequencybandwidth(R7c, 6500, 500);
		} else {
			cascade = 6;
		}
	}
	if (cascade >= 6) {
		resonatorfrequencybandwidth(R6c, frame[F6], frame[B6]);
	}
	if (cascade >= 5) {
		resonatorfrequencybandwidth(R5c, frame[F5], frame[B5]);
	}
	resonatorfrequencybandwidth(R4c, frame[F4], frame[B4]);
	resonatorfrequencybandwidth(R3c, frame[F3], frame[B3]);
	resonatorfrequencybandwidth(R2c, frame[F2], frame[B2]);
	resonatorfrequencybandwidth(R1c, frame[F1], frame[B1]);
	resonatorfrequencybandwidth(Rnpc, frame[Fnp], frame[Bnp]);
	resonatorfrequencybandwidth(Rtpc, frame[Ftp], frame[Btp]);
	antiResonatorfrequencybandwidth(Rnz, frame[Fnz], frame[Bnz]);
	antiResonatorfrequencybandwidth(Rtz, frame[Ftz], frame[Btz]);
	resonatorfrequencybandwidthgain(Rnpp, frame[Fnp], frame[Bnp], ampFNV);
	resonatorfrequencybandwidthgain(Rtpp, frame[Ftp], frame[Btp], ampFTV);
	resonatorfrequencybandwidthgain(R1vp, frame[F1], frame[B1], ampF1V);
	resonatorfrequencybandwidthgain(R2vp, frame[F2], frame[B2], ampF2V);
	resonatorfrequencybandwidthgain(R3vp, frame[F3], frame[B3], ampF3V);
	resonatorfrequencybandwidthgain(R4vp, frame[F4], frame[B4], ampF4V);
	resonatorfrequencybandwidthgain(R2fp, frame[F2], frame[B2f], ampF2F);
	resonatorfrequencybandwidthgain(R3fp, frame[F3], frame[B3f], ampF3F);
	resonatorfrequencybandwidthgain(R4fp, frame[F4], frame[B4f], ampF4F);
	resonatorfrequencybandwidthgain(R5fp, frame[F5], frame[B5f], ampF5F);
	resonatorfrequencybandwidthgain(R6fp, frame[F6], frame[B6f], ampF6F);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}

function synthesizeFrameintostartingAt(aKlattFrame, buffer, startIndex) {
	var ampGain;
	var aspiration;
	var aspirationNoise;
	var bypass;
	var friction;
	var frictionNoise;
	var gain;
	var glotout;
	var index;
	var noise;
	var out;
	var parGlotout;
	var parVoicing;
	var source;
	var temp;
	var top;
	var turbulence;
	var voice;
	var voicing;

	setCurrentFrame(aKlattFrame);
	if (pitch > 0) {
		voicing = linearFromdB(frame[Voicing] - 7);
		parVoicing = linearFromdB(frame[Voicing]);
		turbulence = linearFromdB(frame[Turbulence]) * 0.1;
	} else {
		voicing = (parVoicing = (turbulence = 0.0));
	}
	friction = linearFromdB(frame[Friction]) * 0.25;
	aspiration = linearFromdB(frame[Aspiration]) * 0.05;

	/* -26.0 dB */
	/* Flod overall gain into output resonator (low-pass filter) */

	bypass = linearFromdB(frame[Bypass]) * 0.05;
	gain = frame[Gain] - 3;
	if (gain <= 0) {
		gain = 57;
	}
	ampGain = linearFromdB(gain);
	resonatorfrequencybandwidthgain(Rout, 0, samplingRate, ampGain);
	noise = nlast;
	index = startIndex;
	top = (samplesPerFrame + startIndex) - 1;
	while (index <= top) {

		/* Get low-passed random number for aspiration and friction noise */


		/* radom number between -8196.0 and 8196.0 */
		/* Tilt down noise spectrum by soft low-pass filter having
		 a pole near the origin in the z-plane. */

		noise = (nextRandom() - 32768) / 4.0;
		noise += 0.75 * nlast;

		/* Amplitude modulate noise (reduce noise amplitude during second
		 half of glottal period) if voicing  simultaneously present. */

		nlast = noise;
		if (nper > nmod) {
			noise = noise * 0.5;
		}

		/* Compute voicing waveform. */

		frictionNoise = friction * noise;
		voice = glottalSource();

		/* Add turbulence during glottal open phase.
		 Use random rather than noise because noise is low-passed. */

		vlast = voice;
		if (nper < nopen) {
			voice += (turbulence * (nextRandom() - 32768)) / 4.0;
		}
		glotout = voicing * voice;

		/* Compute aspiration amplitude and add to voicing source. */

		parGlotout = parVoicing * voice;
		aspirationNoise = aspiration * noise;
		glotout += aspirationNoise;

		/* Cascade vocal tract, excited by laryngeal sources.
		 Nasal antiresonator, nasal resonator, trachearl antirresonator,
		 tracheal resonator, then formants F8, F7, F6, F5, F4, F3, F2, F1. */

		parGlotout += aspirationNoise;

		/* Voice-excited parallel vocal tract F1, F2, F3, F4, FNP and FTP. */

		out = cascadeBranch(glotout);

		/* Source is voicing plus aspiration. */

		source = parGlotout;

		/* Friction-excited parallel vocal tract formants F6, F5, F4, F3, F2,
		 outputs added with alternating sign. Sound source for other
		 parallel resonators is friction plus first difference of
		 voicing waveform. */

		out += parallelVoicedBranch(source);
		source = (frictionNoise + parGlotout) - glast;
		glast = parGlotout;

		/* Apply bypas and output low-pass filter */

		out = parallelFrictionBranch(source) - out;
		out = (bypass * source) - out;
		out = resonatorvalue(Rout, out);
		temp = ((out * ampGain)|0);
		if (temp < -32768) {
			temp = -32768;
		}
		if (temp > 32767) {
			temp = 32767;
		}
		buffer[index - 1] = temp;
		++index;
		++samplesCount;
	}
}


/*	Set the pitch. */

function voicedPitchSynchronousReset() {

	/* Add flutter and jitter (F0 perturbations). */

	pitch = frame[F0];
	addFlutter();
	addJitter();
	addFrequencyDiplophonia();
	if (pitch < 0) {
		pitch = 0;
	}

	/* Duration of period before amplitude modulation. */

	t0 = ((samplingRate / pitch)|0);
	nmod = t0;
	if (frame[Voicing] > 0) {
		nmod = nmod >> 1;
	}

	/* Set the LF glottal pulse model parameters. */

	nopen = ((t0 * frame[Ro])|0);
	rorark(frame[Ro], frame[Ra], frame[Rk]);
	addShimmer();
	addAmplitudeDiplophonia();
}

function zeroQphicosphisinphirphid(phi, cosphi, sinphi, rphid) {
	var qa;
	var qb;
	var qc;
	var qzero;
	var ua;
	var ub;
	var uc;

	qzero = quphicosphisinphirphid(0, phi, cosphi, sinphi, rphid);
	if (qzero > 0) {
		ua = 0;
		ub = 1;
		qa = qzero;
		qb = quphicosphisinphirphid(ub, phi, cosphi, sinphi, rphid);
		while (qb > 0) {
			ua = ub;
			qa = qb;
			ub = ub * 2;
			qb = quphicosphisinphirphid(ub, phi, cosphi, sinphi, rphid);
		}
	} else {
		ua = -1;
		ub = 0;
		qa = quphicosphisinphirphid(ua, phi, cosphi, sinphi, rphid);
		qb = qzero;
		while (qa < 0) {
			ub = ua;
			qb = qa;
			ua = ua * 2;
			qa = quphicosphisinphirphid(ua, phi, cosphi, sinphi, rphid);
		}
	}
	while ((ub - ua) > Epsilon) {
		uc = (ub + ua) / 2.0;
		qc = quphicosphisinphirphid(uc, phi, cosphi, sinphi, rphid);
		if (qc > 0) {
			ua = uc;
			qa = qc;
		} else {
			ub = uc;
			qb = qc;
		}
	}
	return (ub + ua) / 2.0;
}


Squeak.registerExternalModule("Klatt", {
	setInterpreter: setInterpreter,
	primitiveSynthesizeFrameIntoStartingAt: primitiveSynthesizeFrameIntoStartingAt,
	getModuleName: getModuleName,
});

}); // end of module

/***** including ../plugins/LargeIntegers.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:21 pm */
/* Automatically generated by
	JSSmartSyntaxPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	LargeIntegersPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.LargeIntegers").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var andOpIndex = 0;
var interpreterProxy = null;
var moduleName = "LargeIntegers v1.5 (e)";
var orOpIndex = 1;
var xorOpIndex = 2;



/*	Argument has to be aBytesOop! */
/*	Tests for any magnitude bits in the interval from start to stopArg. */

function anyBitOfBytesfromto(aBytesOop, start, stopArg) {
	var lastByteIx;
	var digit;
	var magnitude;
	var leftShift;
	var rightShift;
	var firstByteIx;
	var stop;
	var mask;
	var ix;

	// missing DebugCode;
	if ((start < 1) || (stopArg < 1)) {
		return interpreterProxy.primitiveFail();
	}
	magnitude = aBytesOop;
	stop = Math.min(stopArg, highBitOfBytes(magnitude));
	if (start > stop) {
		return false;
	}
	firstByteIx = ((start - 1) >> 3) + 1;
	lastByteIx = ((stop - 1) >> 3) + 1;
	rightShift = MOD((start - 1), 8);
	leftShift = 7 - (MOD((stop - 1), 8));
	if (firstByteIx === lastByteIx) {
		mask = (SHL(255, rightShift)) & (SHR(255, leftShift));
		digit = digitOfBytesat(magnitude, firstByteIx);
		return (digit & mask) !== 0;
	}
	if ((SHR(digitOfBytesat(magnitude, firstByteIx), rightShift)) !== 0) {
		return true;
	}
	for (ix = (firstByteIx + 1); ix <= (lastByteIx - 1); ix++) {
		if (digitOfBytesat(magnitude, ix) !== 0) {
			return true;
		}
	}
	if (((SHL(digitOfBytesat(magnitude, lastByteIx), leftShift)) & 255) !== 0) {
		return true;
	}
	return false;
}


/*	Precondition: bytesOop is not anInteger and a bytes object. */
/*	Function #byteSizeOf: is used by the interpreter, be careful with name
	clashes... */

function byteSizeOfBytes(bytesOop) {
	return SIZEOF(bytesOop);
}


/*	Attention: this method invalidates all oop's! Only newBytes is valid at return. */
/*	Does not normalize. */

function bytesgrowTo(aBytesObject, newLen) {
	var oldLen;
	var copyLen;
	var newBytes;

	newBytes = interpreterProxy.instantiateClassindexableSize(CLASSOF(aBytesObject), newLen);
;
	oldLen = BYTESIZEOF(aBytesObject);
	if (oldLen < newLen) {
		copyLen = oldLen;
	} else {
		copyLen = newLen;
	}
	cDigitCopyFromtolen(aBytesObject.bytes, newBytes.bytes, copyLen);
	return newBytes;
}


/*	Attention: this method invalidates all oop's! Only newBytes is valid at return. */

function bytesOrIntgrowTo(oop, len) {
	var sq_class;
	var val;
	var newBytes;

	if (typeof oop === "number") {
		val = oop;
		if (val < 0) {
			sq_class = interpreterProxy.classLargeNegativeInteger();
		} else {
			sq_class = interpreterProxy.classLargePositiveInteger();
		}
		newBytes = interpreterProxy.instantiateClassindexableSize(sq_class, len);
		cCopyIntValtoBytes(val, newBytes);
	} else {
		newBytes = bytesgrowTo(oop, len);
	}
	return newBytes;
}

function cCopyIntValtoBytes(val, bytes) {
	var pByte;
	var ix;
	var ixLimiT;

	pByte = bytes.bytes;
	for (ix = 1, ixLimiT = cDigitLengthOfCSI(val); ix <= ixLimiT; ix++) {
		pByte[ix - 1] = cDigitOfCSIat(val, ix);
	}
}


/*	pByteRes len = longLen; returns over.. */

function cDigitAddlenwithleninto(pByteShort, shortLen, pByteLong, longLen, pByteRes) {
	var i;
	var limit;
	var accum;

	accum = 0;
	limit = shortLen - 1;
	for (i = 0; i <= limit; i++) {
		accum = ((accum >>> 8) + pByteShort[i]) + pByteLong[i];
		pByteRes[i] = (accum & 255);
	}
	limit = longLen - 1;
	for (i = shortLen; i <= limit; i++) {
		accum = (accum >>> 8) + pByteLong[i];
		pByteRes[i] = (accum & 255);
	}
	return accum >>> 8;
}


/*	Precondition: pFirst len = pSecond len. */

function cDigitComparewithlen(pFirst, pSecond, len) {
	var firstDigit;
	var secondDigit;
	var ix;

	ix = len - 1;
	while (ix >= 0) {
		if (((secondDigit = pSecond[ix])) !== ((firstDigit = pFirst[ix]))) {
			if (secondDigit < firstDigit) {
				return 1;
			} else {
				return -1;
			}
		}
		--ix;
	}
	return 0;
}

function cDigitCopyFromtolen(pFrom, pTo, len) {
	var limit;
	var i;

	;
	limit = len - 1;
	for (i = 0; i <= limit; i++) {
		pTo[i] = pFrom[i];
	}
	return 0;
}

function cDigitDivlenremlenquolen(pDiv, divLen, pRem, remLen, pQuo, quoLen) {
	var b;
	var q;
	var a;
	var dnh;
	var lo;
	var hi;
	var r3;
	var mul;
	var cond;
	var l;
	var k;
	var j;
	var i;
	var dl;
	var ql;
	var r1r2;
	var dh;
	var t;


	/* Last actual byte of data (ST ix) */

	dl = divLen - 1;
	ql = quoLen;
	dh = pDiv[dl - 1];
	if (dl === 1) {
		dnh = 0;
	} else {
		dnh = pDiv[dl - 2];
	}
	for (k = 1; k <= ql; k++) {

		/* maintain quo*arg+rem=self */
		/* Estimate rem/div by dividing the leading two digits of rem by dh. */
		/* The estimate is q = qhi*16r100+qlo, where qhi and qlo are unsigned char. */


		/* r1 := rem digitAt: j. */

		j = (remLen + 1) - k;
		if (pRem[j - 1] === dh) {
			q = 255;
		} else {

			/* Compute q = (r1,r2)//dh, t = (r1,r2)\\dh. */
			/* r2 := (rem digitAt: j - 2). */

			r1r2 = pRem[j - 1];
			r1r2 = (r1r2 << 8) + pRem[j - 2];
			t = MOD(r1r2, dh);

			/* Next compute (hi,lo) := q*dnh */

			q = DIV(r1r2, dh);
			mul = q * dnh;
			hi = mul >>> 8;

			/* Correct overestimate of q.                
				Max of 2 iterations through loop -- see Knuth vol. 2 */

			lo = mul & 255;
			if (j < 3) {
				r3 = 0;
			} else {
				r3 = pRem[j - 3];
			}
					while (true) {
				if ((t < hi) || ((t === hi) && (r3 < lo))) {

					/* i.e. (t,r3) < (hi,lo) */

					--q;
					if (lo < dnh) {
						--hi;
						lo = (lo + 256) - dnh;
					} else {
						lo -= dnh;
					}
					cond = hi >= dh;
				} else {
					cond = false;
				}
				if (!(cond)) break;
				hi -= dh;
			}
		}
		l = j - dl;
		a = 0;
		for (i = 1; i <= divLen; i++) {
			hi = pDiv[i - 1] * (q >>> 8);
			lo = pDiv[i - 1] * (q & 255);
			b = (pRem[l - 1] - a) - (lo & 255);
			pRem[l - 1] = (b & 255);

			/* This is a possible replacement to simulate arithmetic shift (preserving sign of b) */
			/* b := b >> 8 bitOr: (0 - (b >> ((interpreterProxy sizeof: b)*8 */
			/* CHAR_BIT */
			/* -1)) << 8). */

			b = b >> 8;
			a = (hi + (lo >>> 8)) - b;
			++l;
		}
		if (a > 0) {

			/* Add div back into rem, decrease q by 1 */

			--q;
			l = j - dl;
			a = 0;
			for (i = 1; i <= divLen; i++) {
				a = ((a >>> 8) + pRem[l - 1]) + pDiv[i - 1];
				pRem[l - 1] = (a & 255);
				++l;
			}
		}
		pQuo[quoLen - k] = q;
	}
	return 0;
}


/*	Answer the index (in bits) of the high order bit of the receiver, or zero if the    
	 receiver is zero. This method is allowed (and needed) for     
	LargeNegativeIntegers as well, since Squeak's LargeIntegers are     
	sign/magnitude. */

function cDigitHighBitlen(pByte, len) {
	var lastDigit;
	var realLength;

	realLength = len;
	while (((lastDigit = pByte[realLength - 1])) === 0) {
		if (((--realLength)) === 0) {
			return 0;
		}
	}
	return cHighBit(lastDigit) + (8 * (realLength - 1));
}


/*	Answer the number of indexable fields of a CSmallInteger. This value is 
	   the same as the largest legal subscript. */

function cDigitLengthOfCSI(csi) {
	if ((csi < 256) && (csi > -256)) {
		return 1;
	}
	if ((csi < 65536) && (csi > -65536)) {
		return 2;
	}
	if ((csi < 16777216) && (csi > -16777216)) {
		return 3;
	}
	return 4;
}


/*	C indexed! */

function cDigitLshiftfromlentolen(shiftCount, pFrom, lenFrom, pTo, lenTo) {
	var digitShift;
	var carry;
	var digit;
	var i;
	var bitShift;
	var rshift;
	var limit;

	digitShift = shiftCount >> 3;
	bitShift = MOD(shiftCount, 8);
	limit = digitShift - 1;
	for (i = 0; i <= limit; i++) {
		pTo[i] = 0;
	}
	if (bitShift === 0) {

		/* Fast version for digit-aligned shifts */
		/* C indexed! */

		return cDigitReplacefromtowithstartingAt(pTo, digitShift, lenTo - 1, pFrom, 0);
	}
	rshift = 8 - bitShift;
	carry = 0;
	limit = lenFrom - 1;
	for (i = 0; i <= limit; i++) {
		digit = pFrom[i];
		pTo[i + digitShift] = ((carry | (SHL(digit, bitShift))) & 255);
		carry = SHR(digit, rshift);
	}
	if (carry !== 0) {
		pTo[lenTo - 1] = carry;
	}
	return 0;
}

function cDigitMontgomerylentimeslenmodulolenmInvModBinto(pBytesFirst, firstLen, pBytesSecond, secondLen, pBytesThird, thirdLen, mInv, pBytesRes) {
	var k;
	var i;
	var lastByte;
	var limit3;
	var limit2;
	var limit1;
	var u;
	var accum;

	limit1 = firstLen - 1;
	limit2 = secondLen - 1;
	limit3 = thirdLen - 1;
	lastByte = 0;
	for (i = 0; i <= limit1; i++) {
		accum = pBytesRes[0] + (pBytesFirst[i] * pBytesSecond[0]);
		u = (accum * mInv) & 255;
		accum += u * pBytesThird[0];
		for (k = 1; k <= limit2; k++) {
			accum = (((accum >>> 8) + pBytesRes[k]) + (pBytesFirst[i] * pBytesSecond[k])) + (u * pBytesThird[k]);
			pBytesRes[k - 1] = (accum & 255);
		}
		for (k = secondLen; k <= limit3; k++) {
			accum = ((accum >>> 8) + pBytesRes[k]) + (u * pBytesThird[k]);
			pBytesRes[k - 1] = (accum & 255);
		}
		accum = (accum >>> 8) + lastByte;
		pBytesRes[limit3] = (accum & 255);
		lastByte = accum >>> 8;
	}
	for (i = firstLen; i <= limit3; i++) {
		accum = pBytesRes[0];
		u = (accum * mInv) & 255;
		accum += u * pBytesThird[0];
		for (k = 1; k <= limit3; k++) {
			accum = ((accum >>> 8) + pBytesRes[k]) + (u * pBytesThird[k]);
			pBytesRes[k - 1] = (accum & 255);
		}
		accum = (accum >>> 8) + lastByte;
		pBytesRes[limit3] = (accum & 255);
		lastByte = accum >>> 8;
	}
	if (!((lastByte === 0) && (cDigitComparewithlen(pBytesThird, pBytesRes, thirdLen) === 1))) {

		/* self cDigitSub: pBytesThird len: thirdLen with: pBytesRes len: thirdLen into: pBytesRes */

		accum = 0;
		for (i = 0; i <= limit3; i++) {
			accum = (accum + pBytesRes[i]) - pBytesThird[i];
			pBytesRes[i] = (accum & 255);
			accum = accum >> 8;
		}
	}
}

function cDigitMultiplylenwithleninto(pByteShort, shortLen, pByteLong, longLen, pByteRes) {
	var ab;
	var j;
	var digit;
	var carry;
	var i;
	var limitLong;
	var k;
	var limitShort;

	if ((shortLen === 1) && (pByteShort[0] === 0)) {
		return 0;
	}
	if ((longLen === 1) && (pByteLong[0] === 0)) {
		return 0;
	}
	limitShort = shortLen - 1;
	limitLong = longLen - 1;
	for (i = 0; i <= limitShort; i++) {
		if (((digit = pByteShort[i])) !== 0) {
			k = i;

			/* Loop invariant: 0<=carry<=0377, k=i+j-1 (ST) */
			/* -> Loop invariant: 0<=carry<=0377, k=i+j (C) (?) */

			carry = 0;
			for (j = 0; j <= limitLong; j++) {
				ab = pByteLong[j];
				ab = ((ab * digit) + carry) + pByteRes[k];
				carry = ab >>> 8;
				pByteRes[k] = (ab & 255);
				++k;
			}
			pByteRes[k] = carry;
		}
	}
	return 0;
}


/*	Answer the value of an indexable field in the receiver.              
	LargePositiveInteger uses bytes of base two number, and each is a       
	      'digit' base 256. */
/*	ST indexed! */

function cDigitOfCSIat(csi, ix) {
	if (ix < 1) {
		interpreterProxy.primitiveFail();
	}
	if (ix > 4) {
		return 0;
	}
	if (csi < 0) {
		;
		return (SHR((0 - csi), ((ix - 1) * 8))) & 255;
	} else {
		return (SHR(csi, ((ix - 1) * 8))) & 255;
	}
}


/*	pByteRes len = longLen. */

function cDigitOpshortlenlongleninto(opIndex, pByteShort, shortLen, pByteLong, longLen, pByteRes) {
	var i;
	var limit;

	limit = shortLen - 1;
	if (opIndex === andOpIndex) {
		for (i = 0; i <= limit; i++) {
			pByteRes[i] = (pByteShort[i] & pByteLong[i]);
		}
		limit = longLen - 1;
		for (i = shortLen; i <= limit; i++) {
			pByteRes[i] = 0;
		}
		return 0;
	}
	if (opIndex === orOpIndex) {
		for (i = 0; i <= limit; i++) {
			pByteRes[i] = (pByteShort[i] | pByteLong[i]);
		}
		limit = longLen - 1;
		for (i = shortLen; i <= limit; i++) {
			pByteRes[i] = pByteLong[i];
		}
		return 0;
	}
	if (opIndex === xorOpIndex) {
		for (i = 0; i <= limit; i++) {
			pByteRes[i] = (pByteShort[i] ^ pByteLong[i]);
		}
		limit = longLen - 1;
		for (i = shortLen; i <= limit; i++) {
			pByteRes[i] = pByteLong[i];
		}
		return 0;
	}
	return interpreterProxy.primitiveFail();
}


/*	C indexed! */

function cDigitReplacefromtowithstartingAt(pTo, start, stop, pFrom, repStart) {
	return function() {
		// inlining self cDigitCopyFrom: pFrom + repStart to: pTo + start len: stop - start + 1
		var len = stop - start + 1;
		for (var i = 0; i < len; i++) {
			pTo[i + start] = pFrom[i + repStart];
		}
		return 0;
	}();
;
}

function cDigitRshiftfromlentolen(shiftCount, pFrom, fromLen, pTo, toLen) {
	var j;
	var digitShift;
	var carry;
	var digit;
	var bitShift;
	var leftShift;
	var limit;
	var start;

	digitShift = shiftCount >> 3;
	bitShift = MOD(shiftCount, 8);
	if (bitShift === 0) {

		/* Fast version for byte-aligned shifts */
		/* C indexed! */

		return cDigitReplacefromtowithstartingAt(pTo, 0, toLen - 1, pFrom, digitShift);
	}
	leftShift = 8 - bitShift;
	carry = SHR(pFrom[digitShift], bitShift);
	start = digitShift + 1;
	limit = fromLen - 1;
	for (j = start; j <= limit; j++) {
		digit = pFrom[j];
		pTo[j - start] = ((carry | (SHL(digit, leftShift))) & 255);
		carry = SHR(digit, bitShift);
	}
	if (carry !== 0) {
		pTo[toLen - 1] = carry;
	}
	return 0;
}

function cDigitSublenwithleninto(pByteSmall, smallLen, pByteLarge, largeLen, pByteRes) {
	var i;
	var z;


	/* Loop invariant is -1<=z<=0 */

	z = 0;
	for (i = 0; i <= (smallLen - 1); i++) {
		z = (z + pByteLarge[i]) - pByteSmall[i];
		pByteRes[i] = (z & 255);
		z = z >> 8;
	}
	for (i = smallLen; i <= (largeLen - 1); i++) {
		z += pByteLarge[i];
		pByteRes[i] = (z & 255);
		z = z >> 8;
	}
}


/*	Answer the index of the high order bit of the argument, or zero if the  
	argument is zero. */
/*	For 64 bit uints there could be added a 32-shift. */

function cHighBit(uint) {
	var shifted;
	var bitNo;

	shifted = uint;
	bitNo = 0;
	if (!(shifted < (1 << 16))) {
		shifted = shifted >>> 16;
		bitNo += 16;
	}
	if (!(shifted < (1 << 8))) {
		shifted = shifted >>> 8;
		bitNo += 8;
	}
	if (!(shifted < (1 << 4))) {
		shifted = shifted >>> 4;
		bitNo += 4;
	}
	if (!(shifted < (1 << 2))) {
		shifted = shifted >>> 2;
		bitNo += 2;
	}
	if (!(shifted < (1 << 1))) {
		shifted = shifted >>> 1;
		++bitNo;
	}
	return bitNo + shifted;
}


/*	anOop has to be a SmallInteger! */

function createLargeFromSmallInteger(anOop) {
	var size;
	var res;
	var pByte;
	var ix;
	var sq_class;
	var val;

	val = anOop;
	if (val < 0) {
		sq_class = interpreterProxy.classLargeNegativeInteger();
	} else {
		sq_class = interpreterProxy.classLargePositiveInteger();
	}
	size = cDigitLengthOfCSI(val);
	res = interpreterProxy.instantiateClassindexableSize(sq_class, size);
	pByte = res.bytes;
	for (ix = 1; ix <= size; ix++) {
		pByte[ix - 1] = cDigitOfCSIat(val, ix);
	}
	return res;
}


/*	Attention: this method invalidates all oop's! Only newBytes is valid at return. */
/*	Does not normalize. */

function digitLshift(aBytesOop, shiftCount) {
	var newLen;
	var oldLen;
	var newBytes;
	var highBit;

	oldLen = BYTESIZEOF(aBytesOop);
	if (((highBit = cDigitHighBitlen(aBytesOop.bytes, oldLen))) === 0) {
		return 0;
	}
	newLen = ((highBit + shiftCount) + 7) >> 3;
	newBytes = interpreterProxy.instantiateClassindexableSize(CLASSOF(aBytesOop), newLen);
;
	cDigitLshiftfromlentolen(shiftCount, aBytesOop.bytes, oldLen, newBytes.bytes, newLen);
	return newBytes;
}


/*	Attention: this method invalidates all oop's! Only newBytes is valid at return. */
/*	Shift right shiftCount bits, 0<=shiftCount.         
	Discard all digits beyond a, and all zeroes at or below a. */
/*	Does not normalize. */

function digitRshiftlookfirst(aBytesOop, shiftCount, a) {
	var newOop;
	var oldDigitLen;
	var newByteLen;
	var newBitLen;
	var oldBitLen;

	oldBitLen = cDigitHighBitlen(aBytesOop.bytes, a);
	oldDigitLen = (oldBitLen + 7) >> 3;
	newBitLen = oldBitLen - shiftCount;
	if (newBitLen <= 0) {

		/* All bits lost */

		return interpreterProxy.instantiateClassindexableSize(CLASSOF(aBytesOop), 0);
	}
	newByteLen = (newBitLen + 7) >> 3;
	newOop = interpreterProxy.instantiateClassindexableSize(CLASSOF(aBytesOop), newByteLen);
;
	cDigitRshiftfromlentolen(shiftCount, aBytesOop.bytes, oldDigitLen, newOop.bytes, newByteLen);
	return newOop;
}


/*	Does not need to normalize! */

function digitAddLargewith(firstInteger, secondInteger) {
	var sum;
	var shortLen;
	var over;
	var shortInt;
	var resClass;
	var newSum;
	var longLen;
	var firstLen;
	var secondLen;
	var longInt;

	firstLen = BYTESIZEOF(firstInteger);
	secondLen = BYTESIZEOF(secondInteger);
	resClass = CLASSOF(firstInteger);
	if (firstLen <= secondLen) {
		shortInt = firstInteger;
		shortLen = firstLen;
		longInt = secondInteger;
		longLen = secondLen;
	} else {
		shortInt = secondInteger;
		shortLen = secondLen;
		longInt = firstInteger;
		longLen = firstLen;
	}
	sum = interpreterProxy.instantiateClassindexableSize(resClass, longLen);
;
	over = cDigitAddlenwithleninto(shortInt.bytes, shortLen, longInt.bytes, longLen, sum.bytes);
	if (over > 0) {

		/* sum := sum growby: 1. */

			newSum = interpreterProxy.instantiateClassindexableSize(resClass, longLen + 1);
;
		cDigitCopyFromtolen(sum.bytes, newSum.bytes, longLen);

		/* C index! */

		sum = newSum;
		sum.bytes[longLen] = over;
	}
	return sum;
}


/*	Bit logic here is only implemented for positive integers or Zero;
	if rec or arg is negative, it fails. */

function digitBitLogicwithopIndex(firstInteger, secondInteger, opIx) {
	var shortLen;
	var shortLarge;
	var firstLarge;
	var secondLarge;
	var longLen;
	var longLarge;
	var firstLen;
	var secondLen;
	var result;

	if (typeof firstInteger === "number") {
		if (firstInteger < 0) {
			return interpreterProxy.primitiveFail();
		}
			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		if (CLASSOF(firstInteger) === interpreterProxy.classLargeNegativeInteger()) {
			return interpreterProxy.primitiveFail();
		}
		firstLarge = firstInteger;
	}
	if (typeof secondInteger === "number") {
		if (secondInteger < 0) {
			return interpreterProxy.primitiveFail();
		}
			secondLarge = createLargeFromSmallInteger(secondInteger);
;
	} else {
		if (CLASSOF(secondInteger) === interpreterProxy.classLargeNegativeInteger()) {
			return interpreterProxy.primitiveFail();
		}
		secondLarge = secondInteger;
	}
	firstLen = BYTESIZEOF(firstLarge);
	secondLen = BYTESIZEOF(secondLarge);
	if (firstLen < secondLen) {
		shortLen = firstLen;
		shortLarge = firstLarge;
		longLen = secondLen;
		longLarge = secondLarge;
	} else {
		shortLen = secondLen;
		shortLarge = secondLarge;
		longLen = firstLen;
		longLarge = firstLarge;
	}
	result = interpreterProxy.instantiateClassindexableSize(interpreterProxy.classLargePositiveInteger(), longLen);
;
	cDigitOpshortlenlongleninto(opIx, shortLarge.bytes, shortLen, longLarge.bytes, longLen, result.bytes);
	if (interpreterProxy.failed()) {
		return 0;
	}
	return normalizePositive(result);
}


/*	Compare the magnitude of firstInteger with that of secondInteger.      
	Return a code of 1, 0, -1 for firstInteger >, = , < secondInteger */

function digitCompareLargewith(firstInteger, secondInteger) {
	var secondLen;
	var firstLen;

	firstLen = BYTESIZEOF(firstInteger);
	secondLen = BYTESIZEOF(secondInteger);
	if (secondLen !== firstLen) {
		if (secondLen > firstLen) {
			return -1;
		} else {
			return 1;
		}
	}
	return cDigitComparewithlen(firstInteger.bytes, secondInteger.bytes, firstLen);
}


/*	Does not normalize. */
/*	Division by zero has to be checked in caller. */

function digitDivLargewithnegative(firstInteger, secondInteger, neg) {
	var resultClass;
	var result;
	var rem;
	var div;
	var quo;
	var d;
	var l;
	var secondLen;
	var firstLen;

	firstLen = BYTESIZEOF(firstInteger);
	secondLen = BYTESIZEOF(secondInteger);
	if (neg) {
		resultClass = interpreterProxy.classLargeNegativeInteger();
	} else {
		resultClass = interpreterProxy.classLargePositiveInteger();
	}
	l = (firstLen - secondLen) + 1;
	if (l <= 0) {
			result = interpreterProxy.instantiateClassindexableSize(interpreterProxy.classArray(), 2);
;
		interpreterProxy.stObjectatput(result,1,0);
		interpreterProxy.stObjectatput(result,2,firstInteger);
		return result;
	}
	d = 8 - cHighBit(unsafeByteOfat(secondInteger, secondLen));
	div = digitLshift(secondInteger, d);
div = bytesOrIntgrowTo(div, digitLength(div) + 1);
;
	rem = digitLshift(firstInteger, d);
if (digitLength(rem) === firstLen) {
	rem = bytesOrIntgrowTo(rem, firstLen + 1);
}
;
	quo = interpreterProxy.instantiateClassindexableSize(resultClass, l);
;
	cDigitDivlenremlenquolen(div.bytes, digitLength(div), rem.bytes, digitLength(rem), quo.bytes, digitLength(quo));
	rem = digitRshiftlookfirst(rem, d, digitLength(div) - 1);
;
	result = interpreterProxy.instantiateClassindexableSize(interpreterProxy.classArray(), 2);
;
	interpreterProxy.stObjectatput(result,1,quo);
	interpreterProxy.stObjectatput(result,2,rem);
	return result;
}

function digitLength(oop) {
	if (typeof oop === "number") {
		return cDigitLengthOfCSI(oop);
	} else {
		return BYTESIZEOF(oop);
	}
}

function digitMontgomerytimesmodulomInvModB(firstLarge, secondLarge, thirdLarge, mInv) {
	var prod;
	var thirdLen;
	var firstLen;
	var secondLen;

	firstLen = BYTESIZEOF(firstLarge);
	secondLen = BYTESIZEOF(secondLarge);
	thirdLen = BYTESIZEOF(thirdLarge);
	if (!(firstLen <= thirdLen)) {
		return interpreterProxy.primitiveFail();
	}
	if (!(secondLen <= thirdLen)) {
		return interpreterProxy.primitiveFail();
	}
	if (!((mInv >= 0) && (mInv <= 255))) {
		return interpreterProxy.primitiveFail();
	}
	prod = interpreterProxy.instantiateClassindexableSize(interpreterProxy.classLargePositiveInteger(), thirdLen);
;
	cDigitMontgomerylentimeslenmodulolenmInvModBinto(firstLarge.bytes, firstLen, secondLarge.bytes, secondLen, thirdLarge.bytes, thirdLen, mInv, prod.bytes);
	return normalizePositive(prod);
}


/*	Normalizes. */

function digitMultiplyLargewithnegative(firstInteger, secondInteger, neg) {
	var longInt;
	var resultClass;
	var shortLen;
	var shortInt;
	var longLen;
	var prod;
	var secondLen;
	var firstLen;

	firstLen = BYTESIZEOF(firstInteger);
	secondLen = BYTESIZEOF(secondInteger);
	if (firstLen <= secondLen) {
		shortInt = firstInteger;
		shortLen = firstLen;
		longInt = secondInteger;
		longLen = secondLen;
	} else {
		shortInt = secondInteger;
		shortLen = secondLen;
		longInt = firstInteger;
		longLen = firstLen;
	}
	if (neg) {
		resultClass = interpreterProxy.classLargeNegativeInteger();
	} else {
		resultClass = interpreterProxy.classLargePositiveInteger();
	}
	prod = interpreterProxy.instantiateClassindexableSize(resultClass, longLen + shortLen);
;
	cDigitMultiplylenwithleninto(shortInt.bytes, shortLen, longInt.bytes, longLen, prod.bytes);
	return normalize(prod);
}


/*	Argument has to be aLargeInteger! */

function digitOfBytesat(aBytesOop, ix) {
	if (ix > BYTESIZEOF(aBytesOop)) {
		return 0;
	} else {
		return unsafeByteOfat(aBytesOop, ix);
	}
}


/*	Normalizes. */

function digitSubLargewith(firstInteger, secondInteger) {
	var smallerLen;
	var larger;
	var res;
	var smaller;
	var resLen;
	var largerLen;
	var firstNeg;
	var firstLen;
	var secondLen;
	var neg;

	firstNeg = CLASSOF(firstInteger) === interpreterProxy.classLargeNegativeInteger();
	firstLen = BYTESIZEOF(firstInteger);
	secondLen = BYTESIZEOF(secondInteger);
	if (firstLen === secondLen) {
		while ((firstLen > 1) && (digitOfBytesat(firstInteger, firstLen) === digitOfBytesat(secondInteger, firstLen))) {
			--firstLen;
		}
		secondLen = firstLen;
	}
	if ((firstLen < secondLen) || ((firstLen === secondLen) && (digitOfBytesat(firstInteger, firstLen) < digitOfBytesat(secondInteger, firstLen)))) {
		larger = secondInteger;
		largerLen = secondLen;
		smaller = firstInteger;
		smallerLen = firstLen;
		neg = firstNeg === false;
	} else {
		larger = firstInteger;
		largerLen = firstLen;
		smaller = secondInteger;
		smallerLen = secondLen;
		neg = firstNeg;
	}
	resLen = largerLen;
	res = interpreterProxy.instantiateClassindexableSize((neg
	? interpreterProxy.classLargeNegativeInteger()
	: interpreterProxy.classLargePositiveInteger()), resLen);
;
	cDigitSublenwithleninto(smaller.bytes, smallerLen, larger.bytes, largerLen, res.bytes);
	return (neg
		? normalizeNegative(res)
		: normalizePositive(res));
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}

function highBitOfBytes(aBytesOop) {
	return cDigitHighBitlen(aBytesOop.bytes, BYTESIZEOF(aBytesOop));
}

function isNormalized(anInteger) {
	var ix;
	var len;
	var sLen;
	var minVal;
	var maxVal;

	if (typeof anInteger === "number") {
		return true;
	}
	len = digitLength(anInteger);
	if (len === 0) {
		return false;
	}
	if (unsafeByteOfat(anInteger, len) === 0) {
		return false;
	}

	/* maximal digitLength of aSmallInteger */

	sLen = 4;
	if (len > sLen) {
		return true;
	}
	if (len < sLen) {
		return false;
	}
	if (CLASSOF(anInteger) === interpreterProxy.classLargePositiveInteger()) {

		/* SmallInteger maxVal */
		/* all bytes of maxVal but the highest one are just FF's */

		maxVal = 1073741823;
		return unsafeByteOfat(anInteger, sLen) > cDigitOfCSIat(maxVal, sLen);
	} else {

		/* SmallInteger minVal */
		/* all bytes of minVal but the highest one are just 00's */

		minVal = -1073741824;
		if (unsafeByteOfat(anInteger, sLen) < cDigitOfCSIat(minVal, sLen)) {
			return false;
		} else {

			/* if just one digit differs, then anInteger < minval (the corresponding digit byte is greater!)
						and therefore a LargeNegativeInteger */

			for (ix = 1; ix <= sLen; ix++) {
				if (unsafeByteOfat(anInteger, ix) !== cDigitOfCSIat(minVal, ix)) {
					return true;
				}
			}
		}
	}
	return false;
}

function msg(s) {
	console.log(moduleName + ": " + s);
}


/*	Check for leading zeroes and return shortened copy if so. */

function normalize(aLargeInteger) {
	// missing DebugCode;
	if (CLASSOF(aLargeInteger) === interpreterProxy.classLargePositiveInteger()) {
		return normalizePositive(aLargeInteger);
	} else {
		return normalizeNegative(aLargeInteger);
	}
}


/*	Check for leading zeroes and return shortened copy if so. */
/*	First establish len = significant length. */

function normalizeNegative(aLargeNegativeInteger) {
	var i;
	var len;
	var sLen;
	var minVal;
	var oldLen;
	var val;

	len = (oldLen = digitLength(aLargeNegativeInteger));
	while ((len !== 0) && (unsafeByteOfat(aLargeNegativeInteger, len) === 0)) {
		--len;
	}
	if (len === 0) {
		return 0;
	}

	/* SmallInteger minVal digitLength */

	sLen = 4;
	if (len <= sLen) {

		/* SmallInteger minVal */

		minVal = -1073741824;
		if ((len < sLen) || (digitOfBytesat(aLargeNegativeInteger, sLen) < cDigitOfCSIat(minVal, sLen))) {

			/* If high digit less, then can be small */

			val = 0;
			for (i = len; i >= 1; i += -1) {
				val = (val * 256) - unsafeByteOfat(aLargeNegativeInteger, i);
			}
			return val;
		}
		for (i = 1; i <= sLen; i++) {

			/* If all digits same, then = minVal (sr: minVal digits 1 to 3 are 
				          0) */

			if (digitOfBytesat(aLargeNegativeInteger, i) !== cDigitOfCSIat(minVal, i)) {

				/* Not so; return self shortened */

				if (len < oldLen) {

					/* ^ self growto: len */

					return bytesgrowTo(aLargeNegativeInteger, len);
				} else {
					return aLargeNegativeInteger;
				}
			}
		}
		return minVal;
	}
	if (len < oldLen) {

		/* ^ self growto: len */

		return bytesgrowTo(aLargeNegativeInteger, len);
	} else {
		return aLargeNegativeInteger;
	}
}


/*	Check for leading zeroes and return shortened copy if so. */
/*	First establish len = significant length. */

function normalizePositive(aLargePositiveInteger) {
	var i;
	var len;
	var sLen;
	var val;
	var oldLen;

	len = (oldLen = digitLength(aLargePositiveInteger));
	while ((len !== 0) && (unsafeByteOfat(aLargePositiveInteger, len) === 0)) {
		--len;
	}
	if (len === 0) {
		return 0;
	}

	/* SmallInteger maxVal digitLength. */

	sLen = 4;
	if ((len <= sLen) && (digitOfBytesat(aLargePositiveInteger, sLen) <= cDigitOfCSIat(1073741823, sLen))) {

		/* If so, return its SmallInt value */

		val = 0;
		for (i = len; i >= 1; i += -1) {
			val = (val * 256) + unsafeByteOfat(aLargePositiveInteger, i);
		}
		return val;
	}
	if (len < oldLen) {

		/* ^ self growto: len */

		return bytesgrowTo(aLargePositiveInteger, len);
	} else {
		return aLargePositiveInteger;
	}
}

function primAnyBitFromTo() {
	var integer;
	var large;
	var from;
	var to;
	var _return_value;

	from = interpreterProxy.stackIntegerValue(1);
	to = interpreterProxy.stackIntegerValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(2)));
	integer = interpreterProxy.stackValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof integer === "number") {

		/* convert it to a not normalized LargeInteger */

		large = createLargeFromSmallInteger(integer);
	} else {
		large = integer;
	}
	_return_value = (anyBitOfBytesfromto(large, from, to)? interpreterProxy.trueObject() : interpreterProxy.falseObject());
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, _return_value);
	return null;
}


/*	Converts a SmallInteger into a - non normalized! - LargeInteger;          
	 aLargeInteger will be returned unchanged. */
/*	Do not check for forced fail, because we need this conversion to test the 
	plugin in ST during forced fail, too. */

function primAsLargeInteger() {
	var anInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	anInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof anInteger === "number") {
		_return_value = createLargeFromSmallInteger(anInteger);
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(2, _return_value);
		return null;
	} else {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(2, anInteger);
		return null;
	}
}


/*	If calling this primitive fails, then C module does not exist. Do not check for forced fail, because we want to know if module exists during forced fail, too. */

function primCheckIfCModuleExists() {
	var _return_value;

	_return_value = (true? interpreterProxy.trueObject() : interpreterProxy.falseObject());
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(1, _return_value);
	return null;
}

function _primDigitBitShift() {
	var rShift;
	var aLarge;
	var anInteger;
	var shiftCount;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	anInteger = interpreterProxy.stackValue(1);
	shiftCount = interpreterProxy.stackIntegerValue(0);
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof anInteger === "number") {

		/* convert it to a not normalized LargeInteger */

		aLarge = createLargeFromSmallInteger(anInteger);
	} else {
		aLarge = anInteger;
	}
	if (shiftCount >= 0) {
		_return_value = digitLshift(aLarge, shiftCount);
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(3, _return_value);
		return null;
	} else {
		rShift = 0 - shiftCount;
		_return_value = normalize(digitRshiftlookfirst(aLarge, rShift, BYTESIZEOF(aLarge)));
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(3, _return_value);
		return null;
	}
}

function primDigitAdd() {
	var firstLarge;
	var firstInteger;
	var secondLarge;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstLarge = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			secondLarge = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondLarge = secondInteger;
	}
	_return_value = digitAddLargewith(firstLarge, secondLarge);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(2, _return_value);
	return null;
}

function primDigitAddWith() {
	var firstLarge;
	var secondLarge;
	var firstInteger;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstLarge = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			secondLarge = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondLarge = secondInteger;
	}
	_return_value = digitAddLargewith(firstLarge, secondLarge);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, _return_value);
	return null;
}


/*	Bit logic here is only implemented for positive integers or Zero; if rec 
	or arg is negative, it fails. */

function primDigitBitAnd() {
	var firstInteger;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	_return_value = digitBitLogicwithopIndex(firstInteger, secondInteger, andOpIndex);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(2, _return_value);
	return null;
}


/*	Bit logic here is only implemented for positive integers or Zero; if any arg is negative, it fails. */

function primDigitBitLogicWithOp() {
	var firstInteger;
	var secondInteger;
	var opIndex;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(2)));
	firstInteger = interpreterProxy.stackValue(2);
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	secondInteger = interpreterProxy.stackValue(1);
	opIndex = interpreterProxy.stackIntegerValue(0);
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	_return_value = digitBitLogicwithopIndex(firstInteger, secondInteger, opIndex);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(4, _return_value);
	return null;
}


/*	Bit logic here is only implemented for positive integers or Zero; if rec 
	or arg is negative, it fails. */

function primDigitBitOr() {
	var firstInteger;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	_return_value = digitBitLogicwithopIndex(firstInteger, secondInteger, orOpIndex);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(2, _return_value);
	return null;
}

function primDigitBitShift() {
	var aLarge;
	var rShift;
	var anInteger;
	var shiftCount;
	var _return_value;

	shiftCount = interpreterProxy.stackIntegerValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	anInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof anInteger === "number") {

		/* convert it to a not normalized LargeInteger */

		aLarge = createLargeFromSmallInteger(anInteger);
	} else {
		aLarge = anInteger;
	}
	if (shiftCount >= 0) {
		_return_value = digitLshift(aLarge, shiftCount);
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(2, _return_value);
		return null;
	} else {
		rShift = 0 - shiftCount;
		_return_value = normalize(digitRshiftlookfirst(aLarge, rShift, BYTESIZEOF(aLarge)));
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(2, _return_value);
		return null;
	}
}

function primDigitBitShiftMagnitude() {
	var aLarge;
	var rShift;
	var anInteger;
	var shiftCount;
	var _return_value;

	shiftCount = interpreterProxy.stackIntegerValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	anInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof anInteger === "number") {

		/* convert it to a not normalized LargeInteger */

		aLarge = createLargeFromSmallInteger(anInteger);
	} else {
		aLarge = anInteger;
	}
	if (shiftCount >= 0) {
		_return_value = digitLshift(aLarge, shiftCount);
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(2, _return_value);
		return null;
	} else {
		rShift = 0 - shiftCount;
		_return_value = normalize(digitRshiftlookfirst(aLarge, rShift, BYTESIZEOF(aLarge)));
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(2, _return_value);
		return null;
	}
}


/*	Bit logic here is only implemented for positive integers or Zero; if rec 
	or arg is negative, it fails. */

function primDigitBitXor() {
	var firstInteger;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	_return_value = digitBitLogicwithopIndex(firstInteger, secondInteger, xorOpIndex);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(2, _return_value);
	return null;
}

function primDigitCompare() {
	var firstVal;
	var firstInteger;
	var secondVal;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* first */

		if (typeof secondInteger === "number") {

			/* second */

			if (((firstVal = firstInteger)) > ((secondVal = secondInteger))) {
				_return_value = 1;
				if (interpreterProxy.failed()) {
					return null;
				}
				interpreterProxy.popthenPush(2, _return_value);
				return null;
			} else {
				if (firstVal < secondVal) {
					_return_value = -1;
					if (interpreterProxy.failed()) {
						return null;
					}
					interpreterProxy.popthenPush(2, _return_value);
					return null;
				} else {
					_return_value = 0;
					if (interpreterProxy.failed()) {
						return null;
					}
					interpreterProxy.popthenPush(2, _return_value);
					return null;
				}
			}
		} else {

			/* SECOND */

			_return_value = -1;
			if (interpreterProxy.failed()) {
				return null;
			}
			interpreterProxy.popthenPush(2, _return_value);
			return null;
		}
	} else {

		/* FIRST */

		if (typeof secondInteger === "number") {

			/* second */

			_return_value = 1;
			if (interpreterProxy.failed()) {
				return null;
			}
			interpreterProxy.popthenPush(2, _return_value);
			return null;
		} else {

			/* SECOND */

			_return_value = digitCompareLargewith(firstInteger, secondInteger);
			if (interpreterProxy.failed()) {
				return null;
			}
			interpreterProxy.popthenPush(2, _return_value);
			return null;
		}
	}
}

function primDigitCompareWith() {
	var firstVal;
	var secondVal;
	var firstInteger;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* first */

		if (typeof secondInteger === "number") {

			/* second */

			if (((firstVal = firstInteger)) > ((secondVal = secondInteger))) {
				_return_value = 1;
				if (interpreterProxy.failed()) {
					return null;
				}
				interpreterProxy.popthenPush(3, _return_value);
				return null;
			} else {
				if (firstVal < secondVal) {
					_return_value = -1;
					if (interpreterProxy.failed()) {
						return null;
					}
					interpreterProxy.popthenPush(3, _return_value);
					return null;
				} else {
					_return_value = 0;
					if (interpreterProxy.failed()) {
						return null;
					}
					interpreterProxy.popthenPush(3, _return_value);
					return null;
				}
			}
		} else {

			/* SECOND */

			_return_value = -1;
			if (interpreterProxy.failed()) {
				return null;
			}
			interpreterProxy.popthenPush(3, _return_value);
			return null;
		}
	} else {

		/* FIRST */

		if (typeof secondInteger === "number") {

			/* second */

			_return_value = 1;
			if (interpreterProxy.failed()) {
				return null;
			}
			interpreterProxy.popthenPush(3, _return_value);
			return null;
		} else {

			/* SECOND */

			_return_value = digitCompareLargewith(firstInteger, secondInteger);
			if (interpreterProxy.failed()) {
				return null;
			}
			interpreterProxy.popthenPush(3, _return_value);
			return null;
		}
	}
}


/*	Answer the result of dividing firstInteger by secondInteger. 
	Fail if parameters are not integers, not normalized or secondInteger is 
	zero.  */

function primDigitDivNegative() {
	var firstAsLargeInteger;
	var firstInteger;
	var secondAsLargeInteger;
	var secondInteger;
	var neg;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	secondInteger = interpreterProxy.stackValue(1);
	neg = interpreterProxy.booleanValueOf(interpreterProxy.stackValue(0));
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(2)));
	firstInteger = interpreterProxy.stackValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!isNormalized(firstInteger)) {
		// missing DebugCode;
		interpreterProxy.primitiveFail();
		return null;
	}
	if (!isNormalized(secondInteger)) {
		// missing DebugCode;
		interpreterProxy.primitiveFail();
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert to LargeInteger */

			firstAsLargeInteger = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstAsLargeInteger = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* check for zerodivide and convert to LargeInteger */

		if (secondInteger === 0) {
			interpreterProxy.primitiveFail();
			return null;
		}
			secondAsLargeInteger = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondAsLargeInteger = secondInteger;
	}
	_return_value = digitDivLargewithnegative(firstAsLargeInteger, secondAsLargeInteger, neg);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, _return_value);
	return null;
}


/*	Answer the result of dividing firstInteger by secondInteger.
	Fail if parameters are not integers or secondInteger is zero. */

function primDigitDivWithNegative() {
	var firstAsLargeInteger;
	var secondAsLargeInteger;
	var firstInteger;
	var secondInteger;
	var neg;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(2)));
	firstInteger = interpreterProxy.stackValue(2);
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	secondInteger = interpreterProxy.stackValue(1);
	neg = interpreterProxy.booleanValueOf(interpreterProxy.stackValue(0));
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert to LargeInteger */

			firstAsLargeInteger = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstAsLargeInteger = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* check for zerodivide and convert to LargeInteger */

		if (secondInteger === 0) {
			interpreterProxy.primitiveFail();
			return null;
		}
			secondAsLargeInteger = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondAsLargeInteger = secondInteger;
	}
	_return_value = digitDivLargewithnegative(firstAsLargeInteger, secondAsLargeInteger, neg);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(4, _return_value);
	return null;
}

function primDigitMultiplyNegative() {
	var firstLarge;
	var firstInteger;
	var secondLarge;
	var secondInteger;
	var neg;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	secondInteger = interpreterProxy.stackValue(1);
	neg = interpreterProxy.booleanValueOf(interpreterProxy.stackValue(0));
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(2)));
	firstInteger = interpreterProxy.stackValue(2);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstLarge = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			secondLarge = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondLarge = secondInteger;
	}
	_return_value = digitMultiplyLargewithnegative(firstLarge, secondLarge, neg);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, _return_value);
	return null;
}

function primDigitMultiplyWithNegative() {
	var firstLarge;
	var secondLarge;
	var firstInteger;
	var secondInteger;
	var neg;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(2)));
	firstInteger = interpreterProxy.stackValue(2);
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	secondInteger = interpreterProxy.stackValue(1);
	neg = interpreterProxy.booleanValueOf(interpreterProxy.stackValue(0));
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstLarge = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			secondLarge = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondLarge = secondInteger;
	}
	_return_value = digitMultiplyLargewithnegative(firstLarge, secondLarge, neg);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(4, _return_value);
	return null;
}

function primDigitSubtract() {
	var firstLarge;
	var firstInteger;
	var secondLarge;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstLarge = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			secondLarge = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondLarge = secondInteger;
	}
	_return_value = digitSubLargewith(firstLarge, secondLarge);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(2, _return_value);
	return null;
}

function primDigitSubtractWith() {
	var firstLarge;
	var secondLarge;
	var firstInteger;
	var secondInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	firstInteger = interpreterProxy.stackValue(1);
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	secondInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstLarge = firstInteger;
	}
	if (typeof secondInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			secondLarge = createLargeFromSmallInteger(secondInteger);
;
	} else {
		secondLarge = secondInteger;
	}
	_return_value = digitSubLargewith(firstLarge, secondLarge);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, _return_value);
	return null;
}


/*	If calling this primitive fails, then C module does not exist. */

function primGetModuleName() {
	var strPtr;
	var strLen;
	var i;
	var strOop;

	// missing DebugCode;
	strLen = strlen(getModuleName());
	strOop = interpreterProxy.instantiateClassindexableSize(interpreterProxy.classString(), strLen);
	strPtr = strOop.bytes;
	for (i = 0; i <= (strLen - 1); i++) {
		strPtr[i] = getModuleName()[i];
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(1, strOop);
	return null;
}

function primMontgomeryTimesModulo() {
	var firstLarge;
	var secondLarge;
	var firstInteger;
	var thirdLarge;
	var secondOperandInteger;
	var thirdModuloInteger;
	var smallInverseInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(2)));
	secondOperandInteger = interpreterProxy.stackValue(2);
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(1)));
	thirdModuloInteger = interpreterProxy.stackValue(1);
	smallInverseInteger = interpreterProxy.stackIntegerValue(0);
	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(3)));
	firstInteger = interpreterProxy.stackValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof firstInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			firstLarge = createLargeFromSmallInteger(firstInteger);
;
	} else {
		firstLarge = firstInteger;
	}
	if (typeof secondOperandInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			secondLarge = createLargeFromSmallInteger(secondOperandInteger);
;
	} else {
		secondLarge = secondOperandInteger;
	}
	if (typeof thirdModuloInteger === "number") {

		/* convert it to a not normalized LargeInteger */

			thirdLarge = createLargeFromSmallInteger(thirdModuloInteger);
;
	} else {
		thirdLarge = thirdModuloInteger;
	}
	_return_value = digitMontgomerytimesmodulomInvModB(firstLarge, secondLarge, thirdLarge, smallInverseInteger);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(4, _return_value);
	return null;
}


/*	Parameter specification #(Integer) doesn't convert! */

function primNormalize() {
	var anInteger;
	var _return_value;

	interpreterProxy.success(interpreterProxy.isKindOfInteger(interpreterProxy.stackValue(0)));
	anInteger = interpreterProxy.stackValue(0);
	// missing DebugCode;
	if (interpreterProxy.failed()) {
		return null;
	}
	if (typeof anInteger === "number") {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(2, anInteger);
		return null;
	}
	_return_value = normalize(anInteger);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(2, _return_value);
	return null;
}

function primNormalizeNegative() {
	var rcvr;
	var _return_value;

	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.stackValue(0).sqClass === interpreterProxy.classLargeNegativeInteger());
	rcvr = interpreterProxy.stackValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	_return_value = normalizeNegative(rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(1, _return_value);
	return null;
}

function primNormalizePositive() {
	var rcvr;
	var _return_value;

	// missing DebugCode;
	interpreterProxy.success(interpreterProxy.stackValue(0).sqClass === interpreterProxy.classLargePositiveInteger());
	rcvr = interpreterProxy.stackValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	_return_value = normalizePositive(rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(1, _return_value);
	return null;
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


/*	Argument bytesOop must not be aSmallInteger! */

function unsafeByteOfat(bytesOop, ix) {
	var pointer;

	return ((pointer = bytesOop.bytes))[ix - 1];
}


Squeak.registerExternalModule("LargeIntegers", {
	primDigitAddWith: primDigitAddWith,
	primDigitBitShiftMagnitude: primDigitBitShiftMagnitude,
	primGetModuleName: primGetModuleName,
	primDigitBitLogicWithOp: primDigitBitLogicWithOp,
	primCheckIfCModuleExists: primCheckIfCModuleExists,
	primDigitCompare: primDigitCompare,
	primDigitMultiplyNegative: primDigitMultiplyNegative,
	primDigitBitShift: primDigitBitShift,
	primNormalizePositive: primNormalizePositive,
	primDigitSubtractWith: primDigitSubtractWith,
	_primDigitBitShift: _primDigitBitShift,
	primDigitMultiplyWithNegative: primDigitMultiplyWithNegative,
	primDigitSubtract: primDigitSubtract,
	primDigitDivNegative: primDigitDivNegative,
	primNormalizeNegative: primNormalizeNegative,
	primDigitBitOr: primDigitBitOr,
	primMontgomeryTimesModulo: primMontgomeryTimesModulo,
	primDigitBitAnd: primDigitBitAnd,
	primDigitDivWithNegative: primDigitDivWithNegative,
	setInterpreter: setInterpreter,
	primNormalize: primNormalize,
	primDigitBitXor: primDigitBitXor,
	primDigitCompareWith: primDigitCompareWith,
	primDigitAdd: primDigitAdd,
	getModuleName: getModuleName,
	primAsLargeInteger: primAsLargeInteger,
	primAnyBitFromTo: primAnyBitFromTo,
});

}); // end of module

/***** including ../plugins/Matrix2x3Plugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:21 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	Matrix2x3Plugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.Matrix2x3Plugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var interpreterProxy = null;
var m23ArgX = 0;
var m23ArgY = 0;
var m23ResultX = 0;
var m23ResultY = 0;
var moduleName = "Matrix2x3Plugin 3 November 2014 (e)";



/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}


/*	Load the argument matrix */

function loadArgumentMatrix(matrix) {
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!(interpreterProxy.isWords(matrix) && (SIZEOF(matrix) === 6))) {
		interpreterProxy.primitiveFail();
		return null;
	}
	return matrix.wordsAsFloat32Array();
}


/*	Load the argument point into m23ArgX and m23ArgY */

function loadArgumentPoint(point) {
	var isInt;
	var oop;

	if (interpreterProxy.failed()) {
		return null;
	}
	if (CLASSOF(point) !== interpreterProxy.classPoint()) {
		return interpreterProxy.primitiveFail();
	}
	oop = interpreterProxy.fetchPointerofObject(0, point);
	isInt = typeof oop === "number";
	if (!(isInt || (oop.isFloat))) {
		return interpreterProxy.primitiveFail();
	}
	if (isInt) {
		m23ArgX = oop;
	} else {
		m23ArgX = interpreterProxy.floatValueOf(oop);
	}
	oop = interpreterProxy.fetchPointerofObject(1, point);
	isInt = typeof oop === "number";
	if (!(isInt || (oop.isFloat))) {
		return interpreterProxy.primitiveFail();
	}
	if (isInt) {
		m23ArgY = oop;
	} else {
		m23ArgY = interpreterProxy.floatValueOf(oop);
	}
}


/*	Multiply matrix m1 with m2 and store the result into m3. */

function matrix2x3ComposeMatrixwithinto(m1, m2, m3) {
	var a11;
	var a12;
	var a13;
	var a21;
	var a22;
	var a23;

	a11 = (m1[0] * m2[0]) + (m1[1] * m2[3]);
	a12 = (m1[0] * m2[1]) + (m1[1] * m2[4]);
	a13 = ((m1[0] * m2[2]) + (m1[1] * m2[5])) + m1[2];
	a21 = (m1[3] * m2[0]) + (m1[4] * m2[3]);
	a22 = (m1[3] * m2[1]) + (m1[4] * m2[4]);
	a23 = ((m1[3] * m2[2]) + (m1[4] * m2[5])) + m1[5];
	m3[0] = a11;
	m3[1] = a12;
	m3[2] = a13;
	m3[3] = a21;
	m3[4] = a22;
	m3[5] = a23;
}


/*	Invert the pre-loaded argument point by the given matrix */

function matrix2x3InvertPoint(m) {
	var det;
	var detX;
	var detY;
	var x;
	var y;

	x = m23ArgX - m[2];
	y = m23ArgY - m[5];
	det = (m[0] * m[4]) - (m[1] * m[3]);
	if (det === 0.0) {
		return interpreterProxy.primitiveFail();
	}
	det = 1.0 / det;
	detX = (x * m[4]) - (m[1] * y);
	detY = (m[0] * y) - (x * m[3]);
	m23ResultX = detX * det;
	m23ResultY = detY * det;
}


/*	Transform the pre-loaded argument point by the given matrix */

function matrix2x3TransformPoint(m) {
	m23ResultX = ((m23ArgX * m[0]) + (m23ArgY * m[1])) + m[2];
	m23ResultY = ((m23ArgX * m[3]) + (m23ArgY * m[4])) + m[5];
}

function okayIntValue(value) {
	return (value >= -1073741824) && (m23ResultX <= 1073741823);
}

function primitiveComposeMatrix() {
	var m1;
	var m2;
	var m3;
	var result;

	;
	m3 = loadArgumentMatrix((result = interpreterProxy.stackObjectValue(0)));
	m2 = loadArgumentMatrix(interpreterProxy.stackObjectValue(1));
	m1 = loadArgumentMatrix(interpreterProxy.stackObjectValue(2));
	if (interpreterProxy.failed()) {
		return null;
	}
	matrix2x3ComposeMatrixwithinto(m1, m2, m3);
	interpreterProxy.popthenPush(3, result);
}

function primitiveInvertPoint() {
	var matrix;

	loadArgumentPoint(interpreterProxy.stackObjectValue(0));
	matrix = loadArgumentMatrix(interpreterProxy.stackObjectValue(1));
	if (interpreterProxy.failed()) {
		return null;
	}
	matrix2x3InvertPoint(matrix);
	if (!interpreterProxy.failed()) {
		roundAndStoreResultPoint(2);
	}
}

function primitiveInvertRectInto() {
	var cornerX;
	var cornerY;
	var dstOop;
	var matrix;
	var maxX;
	var maxY;
	var minX;
	var minY;
	var originX;
	var originY;
	var srcOop;

	dstOop = interpreterProxy.stackObjectValue(0);
	srcOop = interpreterProxy.stackObjectValue(1);
	matrix = loadArgumentMatrix(interpreterProxy.stackObjectValue(2));
	if (interpreterProxy.failed()) {
		return null;
	}
	if (CLASSOF(srcOop) !== CLASSOF(dstOop)) {
		return interpreterProxy.primitiveFail();
	}
	if (!interpreterProxy.isPointers(srcOop)) {
		return interpreterProxy.primitiveFail();
	}
	if (SIZEOF(srcOop) !== 2) {
		return interpreterProxy.primitiveFail();
	}
	loadArgumentPoint(interpreterProxy.fetchPointerofObject(0, srcOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	originX = m23ArgX;
	originY = m23ArgY;
	matrix2x3InvertPoint(matrix);
	minX = (maxX = m23ResultX);

	/* Load bottom-right point */

	minY = (maxY = m23ResultY);
	loadArgumentPoint(interpreterProxy.fetchPointerofObject(1, srcOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	cornerX = m23ArgX;
	cornerY = m23ArgY;
	matrix2x3InvertPoint(matrix);
	minX = Math.min(minX, m23ResultX);
	maxX = Math.max(maxX, m23ResultX);
	minY = Math.min(minY, m23ResultY);

	/* Load top-right point */

	maxY = Math.max(maxY, m23ResultY);
	m23ArgX = cornerX;
	m23ArgY = originY;
	matrix2x3InvertPoint(matrix);
	minX = Math.min(minX, m23ResultX);
	maxX = Math.max(maxX, m23ResultX);
	minY = Math.min(minY, m23ResultY);

	/* Load bottom-left point */

	maxY = Math.max(maxY, m23ResultY);
	m23ArgX = originX;
	m23ArgY = cornerY;
	matrix2x3InvertPoint(matrix);
	minX = Math.min(minX, m23ResultX);
	maxX = Math.max(maxX, m23ResultX);
	minY = Math.min(minY, m23ResultY);
	maxY = Math.max(maxY, m23ResultY);
	if (!interpreterProxy.failed()) {
		dstOop = roundAndStoreResultRectx0y0x1y1(dstOop, minX, minY, maxX, maxY);
	}
	if (!interpreterProxy.failed()) {
		interpreterProxy.popthenPush(3, dstOop);
	}
}

function primitiveIsIdentity() {
	var matrix;

	matrix = loadArgumentMatrix(interpreterProxy.stackObjectValue(0));
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(1);
	interpreterProxy.pushBool((((((matrix[0] === 1.0) && (matrix[1] === 0.0)) && (matrix[2] === 0.0)) && (matrix[3] === 0.0)) && (matrix[4] === 1.0)) && (matrix[5] === 0.0));
}

function primitiveIsPureTranslation() {
	var matrix;

	matrix = loadArgumentMatrix(interpreterProxy.stackObjectValue(0));
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(1);
	interpreterProxy.pushBool((((matrix[0] === 1.0) && (matrix[1] === 0.0)) && (matrix[3] === 0.0)) && (matrix[4] === 1.0));
}

function primitiveTransformPoint() {
	var matrix;

	loadArgumentPoint(interpreterProxy.stackObjectValue(0));
	matrix = loadArgumentMatrix(interpreterProxy.stackObjectValue(1));
	if (interpreterProxy.failed()) {
		return null;
	}
	matrix2x3TransformPoint(matrix);
	roundAndStoreResultPoint(2);
}

function primitiveTransformRectInto() {
	var cornerX;
	var cornerY;
	var dstOop;
	var matrix;
	var maxX;
	var maxY;
	var minX;
	var minY;
	var originX;
	var originY;
	var srcOop;

	dstOop = interpreterProxy.stackObjectValue(0);
	srcOop = interpreterProxy.stackObjectValue(1);
	matrix = loadArgumentMatrix(interpreterProxy.stackObjectValue(2));
	if (interpreterProxy.failed()) {
		return null;
	}
	if (CLASSOF(srcOop) !== CLASSOF(dstOop)) {
		return interpreterProxy.primitiveFail();
	}
	if (!interpreterProxy.isPointers(srcOop)) {
		return interpreterProxy.primitiveFail();
	}
	if (SIZEOF(srcOop) !== 2) {
		return interpreterProxy.primitiveFail();
	}
	loadArgumentPoint(interpreterProxy.fetchPointerofObject(0, srcOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	originX = m23ArgX;
	originY = m23ArgY;
	matrix2x3TransformPoint(matrix);
	minX = (maxX = m23ResultX);

	/* Load bottom-right point */

	minY = (maxY = m23ResultY);
	loadArgumentPoint(interpreterProxy.fetchPointerofObject(1, srcOop));
	if (interpreterProxy.failed()) {
		return null;
	}
	cornerX = m23ArgX;
	cornerY = m23ArgY;
	matrix2x3TransformPoint(matrix);
	minX = Math.min(minX, m23ResultX);
	maxX = Math.max(maxX, m23ResultX);
	minY = Math.min(minY, m23ResultY);

	/* Load top-right point */

	maxY = Math.max(maxY, m23ResultY);
	m23ArgX = cornerX;
	m23ArgY = originY;
	matrix2x3TransformPoint(matrix);
	minX = Math.min(minX, m23ResultX);
	maxX = Math.max(maxX, m23ResultX);
	minY = Math.min(minY, m23ResultY);

	/* Load bottom-left point */

	maxY = Math.max(maxY, m23ResultY);
	m23ArgX = originX;
	m23ArgY = cornerY;
	matrix2x3TransformPoint(matrix);
	minX = Math.min(minX, m23ResultX);
	maxX = Math.max(maxX, m23ResultX);
	minY = Math.min(minY, m23ResultY);
	maxY = Math.max(maxY, m23ResultY);
	dstOop = roundAndStoreResultRectx0y0x1y1(dstOop, minX, minY, maxX, maxY);
	if (!interpreterProxy.failed()) {
		interpreterProxy.popthenPush(3, dstOop);
	}
}


/*	Store the result of a previous operation.
	Fail if we cannot represent the result as SmallInteger */

function roundAndStoreResultPoint(nItemsToPop) {
	m23ResultX += 0.5;
	m23ResultY += 0.5;
	if (!okayIntValue(m23ResultX)) {
		return interpreterProxy.primitiveFail();
	}
	if (!okayIntValue(m23ResultY)) {
		return interpreterProxy.primitiveFail();
	}
	interpreterProxy.popthenPush(nItemsToPop, interpreterProxy.makePointwithxValueyValue((m23ResultX|0), (m23ResultY|0)));
}


/*	Check, round and store the result of a rectangle operation */

function roundAndStoreResultRectx0y0x1y1(dstOop, x0, y0, x1, y1) {
	var cornerOop;
	var maxX;
	var maxY;
	var minX;
	var minY;
	var originOop;
	var rectOop;

	minX = x0 + 0.5;
	if (!okayIntValue(minX)) {
		return interpreterProxy.primitiveFail();
	}
	maxX = x1 + 0.5;
	if (!okayIntValue(maxX)) {
		return interpreterProxy.primitiveFail();
	}
	minY = y0 + 0.5;
	if (!okayIntValue(minY)) {
		return interpreterProxy.primitiveFail();
	}
	maxY = y1 + 0.5;
	if (!okayIntValue(maxY)) {
		return interpreterProxy.primitiveFail();
	}
	interpreterProxy.pushRemappableOop(dstOop);
	originOop = interpreterProxy.makePointwithxValueyValue((minX|0), (minY|0));
	interpreterProxy.pushRemappableOop(originOop);
	cornerOop = interpreterProxy.makePointwithxValueyValue((maxX|0), (maxY|0));
	originOop = interpreterProxy.popRemappableOop();
	rectOop = interpreterProxy.popRemappableOop();
	interpreterProxy.storePointerofObjectwithValue(0, rectOop, originOop);
	interpreterProxy.storePointerofObjectwithValue(1, rectOop, cornerOop);
	return rectOop;
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


Squeak.registerExternalModule("Matrix2x3Plugin", {
	primitiveInvertPoint: primitiveInvertPoint,
	primitiveInvertRectInto: primitiveInvertRectInto,
	primitiveIsIdentity: primitiveIsIdentity,
	primitiveComposeMatrix: primitiveComposeMatrix,
	setInterpreter: setInterpreter,
	primitiveTransformRectInto: primitiveTransformRectInto,
	primitiveIsPureTranslation: primitiveIsPureTranslation,
	getModuleName: getModuleName,
	primitiveTransformPoint: primitiveTransformPoint,
});

}); // end of module

/***** including ../plugins/MiscPrimitivePlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:23 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	MiscPrimitivePlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.MiscPrimitivePlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var interpreterProxy = null;
var moduleName = "MiscPrimitivePlugin 3 November 2014 (e)";



/*	Copy the integer anInt into byteArray ba at index i, and return the next index */

function encodeBytesOfinat(anInt, ba, i) {
	var j;

	for (j = 0; j <= 3; j++) {
		ba[(i + j) - 1] = ((SHR(anInt, ((3 - j) * 8))) & 255);
	}
	return i + 4;
}


/*	Encode the integer anInt in byteArray ba at index i, and return the next index.
	The encoding is as follows...
		0-223	0-223
		224-254	(0-30)*256 + next byte (0-7935)
		255		next 4 bytes */

function encodeIntinat(anInt, ba, i) {
	if (anInt <= 223) {
		ba[i - 1] = anInt;
		return i + 1;
	}
	if (anInt <= 7935) {
		ba[i - 1] = ((anInt >> 8) + 224);
		ba[i] = (MOD(anInt, 256));
		return i + 2;
	}
	ba[i - 1] = 255;
	return encodeBytesOfinat(anInt, ba, i + 1);
}


/*	Note: This is coded so that plugins can be run from Squeak. */

function getInterpreter() {
	return interpreterProxy;
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}

function msg(s) {
	console.log(moduleName + ": " + s);
}


/*	Return 1, 2 or 3, if string1 is <, =, or > string2, with the collating order of characters given by the order array. */

function primitiveCompareString() {
	var rcvr;
	var string1;
	var string2;
	var order;
	var c1;
	var c2;
	var i;
	var len1;
	var len2;

	rcvr = interpreterProxy.stackValue(3);
	string1 = interpreterProxy.stackBytes(2);
	string2 = interpreterProxy.stackBytes(1);
	order = interpreterProxy.stackBytes(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	len1 = string1.length;
	len2 = string2.length;
	for (i = 1; i <= Math.min(len1, len2); i++) {
		c1 = order[string1[i - 1]];
		c2 = order[string2[i - 1]];
		if (c1 !== c2) {
			if (c1 < c2) {
				if (interpreterProxy.failed()) {
					return null;
				}
				interpreterProxy.popthenPush(4, 1);
				return null;
			} else {
				if (interpreterProxy.failed()) {
					return null;
				}
				interpreterProxy.popthenPush(4, 3);
				return null;
			}
		}
	}
	if (len1 === len2) {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(4, 2);
		return null;
	}
	if (len1 < len2) {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(4, 1);
		return null;
	} else {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(4, 3);
		return null;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(3);
}


/*	Store a run-coded compression of the receiver into the byteArray ba,
	and return the last index stored into. ba is assumed to be large enough.
	The encoding is as follows...
		S {N D}*.
		S is the size of the original bitmap, followed by run-coded pairs.
		N is a run-length * 4 + data code.
		D, the data, depends on the data code...
			0	skip N words, D is absent
			1	N words with all 4 bytes = D (1 byte)
			2	N words all = D (4 bytes)
			3	N words follow in D (4N bytes)
		S and N are encoded as follows...
			0-223	0-223
			224-254	(0-30)*256 + next byte (0-7935)
			255		next 4 bytes */

function primitiveCompressToByteArray() {
	var rcvr;
	var bm;
	var ba;
	var eqBytes;
	var i;
	var j;
	var k;
	var lowByte;
	var m;
	var size;
	var word;

	rcvr = interpreterProxy.stackValue(2);
	bm = interpreterProxy.stackInt32Array(1);
	ba = interpreterProxy.stackBytes(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	size = bm.length;
	i = encodeIntinat(size, ba, 1);
	k = 1;
	while (k <= size) {
		word = bm[k - 1];
		lowByte = word & 255;
		eqBytes = (((word >>> 8) & 255) === lowByte) && ((((word >>> 16) & 255) === lowByte) && (((word >>> 24) & 255) === lowByte));
		j = k;
		while ((j < size) && (word === bm[j])) {
			++j;
		}
		if (j > k) {

			/* We have two or more = words, ending at j */

			if (eqBytes) {

				/* Actually words of = bytes */

				i = encodeIntinat((((j - k) + 1) * 4) + 1, ba, i);
				ba[i - 1] = lowByte;
				++i;
			} else {
				i = encodeIntinat((((j - k) + 1) * 4) + 2, ba, i);
				i = encodeBytesOfinat(word, ba, i);
			}
			k = j + 1;
		} else {

			/* Check for word of 4 = bytes */

			if (eqBytes) {

				/* Note 1 word of 4 = bytes */

				i = encodeIntinat((1 * 4) + 1, ba, i);
				ba[i - 1] = lowByte;
				++i;
				++k;
			} else {

				/* Finally, check for junk */

				while ((j < size) && (bm[j - 1] !== bm[j])) {
					++j;
				}
				if (j === size) {
					++j;
				}
				i = encodeIntinat(((j - k) * 4) + 3, ba, i);
				for (m = k; m <= (j - 1); m++) {
					i = encodeBytesOfinat(bm[m - 1], ba, i);
				}
				k = j;
			}
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, i - 1);
	return null;
}


/*	Copy the contents of the given array of signed 8-bit samples into the given array of 16-bit signed samples. */

function primitiveConvert8BitSigned() {
	var rcvr;
	var aByteArray;
	var aSoundBuffer;
	var i;
	var n;
	var s;

	rcvr = interpreterProxy.stackValue(2);
	aByteArray = interpreterProxy.stackBytes(1);
	aSoundBuffer = interpreterProxy.stackUint16Array(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	n = aByteArray.length;
	for (i = 1; i <= n; i++) {
		s = aByteArray[i - 1];
		if (s > 127) {
			aSoundBuffer[i - 1] = ((s - 256) << 8);
		} else {
			aSoundBuffer[i - 1] = (s << 8);
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(2);
}


/*	Decompress the body of a byteArray encoded by compressToByteArray (qv)...
	The format is simply a sequence of run-coded pairs, {N D}*.
		N is a run-length * 4 + data code.
		D, the data, depends on the data code...
			0	skip N words, D is absent
				(could be used to skip from one raster line to the next)
			1	N words with all 4 bytes = D (1 byte)
			2	N words all = D (4 bytes)
			3	N words follow in D (4N bytes)
		S and N are encoded as follows (see decodeIntFrom:)...
			0-223	0-223
			224-254	(0-30)*256 + next byte (0-7935)
			255		next 4 bytes */
/*	NOTE:  If fed with garbage, this routine could read past the end of ba, but it should fail before writing past the ned of bm. */

function primitiveDecompressFromByteArray() {
	var rcvr;
	var bm;
	var ba;
	var index;
	var anInt;
	var code;
	var data;
	var end;
	var i;
	var j;
	var k;
	var m;
	var n;
	var pastEnd;

	rcvr = interpreterProxy.stackValue(3);
	bm = interpreterProxy.stackInt32Array(2);
	ba = interpreterProxy.stackBytes(1);
	index = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}

	/* byteArray read index */

	i = index;
	end = ba.length;

	/* bitmap write index */

	k = 1;
	pastEnd = bm.length + 1;
	while (i <= end) {

		/* Decode next run start N */

		anInt = ba[i - 1];
		++i;
		if (!(anInt <= 223)) {
			if (anInt <= 254) {
				anInt = ((anInt - 224) * 256) + ba[i - 1];
				++i;
			} else {
				anInt = 0;
				for (j = 1; j <= 4; j++) {
					anInt = (anInt << 8) + ba[i - 1];
					++i;
				}
			}
		}
		n = anInt >>> 2;
		if ((k + n) > pastEnd) {
			interpreterProxy.primitiveFail();
			return null;
		}
		code = anInt & 3;
		if (code === 0) {

			/* skip */

			null;
		}
		if (code === 1) {

			/* n consecutive words of 4 bytes = the following byte */

			data = ba[i - 1];
			++i;
			data = data | (data << 8);
			data = data | (data << 16);
			for (j = 1; j <= n; j++) {
				bm[k - 1] = data;
				++k;
			}
		}
		if (code === 2) {

			/* n consecutive words = 4 following bytes */

			data = 0;
			for (j = 1; j <= 4; j++) {
				data = (data << 8) | ba[i - 1];
				++i;
			}
			for (j = 1; j <= n; j++) {
				bm[k - 1] = data;
				++k;
			}
		}
		if (code === 3) {

			/* n consecutive words from the data... */

			for (m = 1; m <= n; m++) {
				data = 0;
				for (j = 1; j <= 4; j++) {
					data = (data << 8) | ba[i - 1];
					++i;
				}
				bm[k - 1] = data;
				++k;
			}
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(3);
}

function primitiveFindFirstInString() {
	var rcvr;
	var aString;
	var inclusionMap;
	var start;
	var i;
	var stringSize;

	rcvr = interpreterProxy.stackValue(3);
	aString = interpreterProxy.stackBytes(2);
	inclusionMap = interpreterProxy.stackBytes(1);
	start = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (inclusionMap.length !== 256) {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(4, 0);
		return null;
	}
	i = start;
	stringSize = aString.length;
	while ((i <= stringSize) && (inclusionMap[aString[i - 1]] === 0)) {
		++i;
	}
	if (i > stringSize) {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(4, 0);
		return null;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(4, i);
	return null;
}


/*	Answer the index in the string body at which the substring key first occurs, at or beyond start.  The match is determined using matchTable, which can be used to effect, eg, case-insensitive matches.  If no match is found, zero will be returned.

	The algorithm below is not optimum -- it is intended to be translated to C which will go so fast that it wont matter. */

function primitiveFindSubstring() {
	var rcvr;
	var key;
	var body;
	var start;
	var matchTable;
	var index;
	var startIndex;

	rcvr = interpreterProxy.stackValue(4);
	key = interpreterProxy.stackBytes(3);
	body = interpreterProxy.stackBytes(2);
	start = interpreterProxy.stackIntegerValue(1);
	matchTable = interpreterProxy.stackBytes(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (key.length === 0) {
		if (interpreterProxy.failed()) {
			return null;
		}
		interpreterProxy.popthenPush(5, 0);
		return null;
	}
	for (startIndex = start; startIndex <= ((body.length - key.length) + 1); startIndex++) {
		index = 1;
		while (matchTable[body[((startIndex + index) - 1) - 1]] === matchTable[key[index - 1]]) {
			if (index === key.length) {
				if (interpreterProxy.failed()) {
					return null;
				}
				interpreterProxy.popthenPush(5, startIndex);
				return null;
			}
			++index;
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(5, 0);
	return null;
}

function primitiveIndexOfAsciiInString() {
	var rcvr;
	var anInteger;
	var aString;
	var start;
	var pos;
	var stringSize;

	rcvr = interpreterProxy.stackValue(3);
	anInteger = interpreterProxy.stackIntegerValue(2);
	aString = interpreterProxy.stackBytes(1);
	start = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	stringSize = aString.length;
	for (pos = start; pos <= stringSize; pos++) {
		if (aString[pos - 1] === anInteger) {
			if (interpreterProxy.failed()) {
				return null;
			}
			interpreterProxy.popthenPush(4, pos);
			return null;
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(4, 0);
	return null;
}


/*	Answer the hash of a byte-indexed collection,
	using speciesHash as the initial value.
	See SmallInteger>>hashMultiply.

	The primitive should be renamed at a
	suitable point in the future */

function primitiveStringHash() {
	var rcvr;
	var aByteArray;
	var speciesHash;
	var byteArraySize;
	var hash;
	var low;
	var pos;

	rcvr = interpreterProxy.stackValue(2);
	aByteArray = interpreterProxy.stackBytes(1);
	speciesHash = interpreterProxy.stackIntegerValue(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	byteArraySize = aByteArray.length;
	hash = speciesHash & 268435455;
	for (pos = 1; pos <= byteArraySize; pos++) {

		/* Begin hashMultiply */

		hash += aByteArray[pos - 1];
		low = hash & 16383;
		hash = ((9741 * low) + ((((9741 * (hash >>> 14)) + (101 * low)) & 16383) * 16384)) & 268435455;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.popthenPush(3, hash);
	return null;
}


/*	translate the characters in the string by the given table, in place */

function primitiveTranslateStringWithTable() {
	var rcvr;
	var aString;
	var start;
	var stop;
	var table;
	var i;

	rcvr = interpreterProxy.stackValue(4);
	aString = interpreterProxy.stackBytes(3);
	start = interpreterProxy.stackIntegerValue(2);
	stop = interpreterProxy.stackIntegerValue(1);
	table = interpreterProxy.stackBytes(0);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (i = start; i <= stop; i++) {
		aString[i - 1] = table[aString[i - 1]];
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.pop(4);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


Squeak.registerExternalModule("MiscPrimitivePlugin", {
	primitiveConvert8BitSigned: primitiveConvert8BitSigned,
	primitiveCompareString: primitiveCompareString,
	primitiveTranslateStringWithTable: primitiveTranslateStringWithTable,
	primitiveStringHash: primitiveStringHash,
	primitiveCompressToByteArray: primitiveCompressToByteArray,
	primitiveFindSubstring: primitiveFindSubstring,
	primitiveIndexOfAsciiInString: primitiveIndexOfAsciiInString,
	setInterpreter: setInterpreter,
	primitiveDecompressFromByteArray: primitiveDecompressFromByteArray,
	getModuleName: getModuleName,
	primitiveFindFirstInString: primitiveFindFirstInString,
});

}); // end of module

/***** including ../plugins/ScratchPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:23 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	ScratchPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.ScratchPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var interpreterProxy = null;
var moduleName = "ScratchPlugin 3 November 2014 (e)";


function bitmapatputHsv(bitmap, i, hue, saturation, brightness) {
	var hF;
	var hI;
	var outPix;
	var p;
	var q;
	var t;
	var v;


	/* integer part of hue (0..5) */

	hI = DIV(hue, 60);

	/* fractional part ofhue */

	hF = MOD(hue, 60);
	p = (1000 - saturation) * brightness;
	q = (1000 - (DIV((saturation * hF), 60))) * brightness;
	t = (1000 - (DIV((saturation * (60 - hF)), 60))) * brightness;
	v = DIV((brightness * 1000), 3922);
	p = DIV(p, 3922);
	q = DIV(q, 3922);
	t = DIV(t, 3922);
	if (0 === hI) {
		outPix = ((v << 16) + (t << 8)) + p;
	}
	if (1 === hI) {
		outPix = ((q << 16) + (v << 8)) + p;
	}
	if (2 === hI) {
		outPix = ((p << 16) + (v << 8)) + t;
	}
	if (3 === hI) {
		outPix = ((p << 16) + (q << 8)) + v;
	}
	if (4 === hI) {
		outPix = ((t << 16) + (p << 8)) + v;
	}
	if (5 === hI) {
		outPix = ((v << 16) + (p << 8)) + q;
	}
	if (outPix === 0) {
		outPix = 1;
	}
	bitmap[i] = outPix;
	return 0;
}


/*	Return an unsigned int pointer to the first indexable word of oop, which must be a words object. */

function checkedFloatPtrOf(oop) {
	interpreterProxy.success(interpreterProxy.isWordsOrBytes(oop));
	if (interpreterProxy.failed()) {
		return 0;
	}
	return oop.wordsAsFloat64Array();
}


/*	Return an unsigned int pointer to the first indexable word of oop, which must be a words object. */

function checkedUnsignedIntPtrOf(oop) {
	interpreterProxy.success(interpreterProxy.isWords(oop));
	if (interpreterProxy.failed()) {
		return 0;
	}
	return oop.words;
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}


/*	Answer the hue, an angle between 0 and 360. */

function hueFromRGBminmax(r, g, b, min, max) {
	var result;
	var span;

	span = max - min;
	if (span === 0) {
		return 0;
	}
	if (r === max) {
		result = DIV((60 * (g - b)), span);
	} else {
		if (g === max) {
			result = 120 + (DIV((60 * (b - r)), span));
		} else {
			result = 240 + (DIV((60 * (r - g)), span));
		}
	}
	if (result < 0) {
		return result + 360;
	}
	return result;
}


/*	Answer the interpolated pixel value between the given two pixel values. If either pixel is zero (transparent) answer the other pixel. If both pixels are  transparent, answer transparent. The fraction is between 0 and 1023, out of a total range of 1024. */

function interpolateandfrac(pix1, pix2, frac2) {
	var b;
	var frac1;
	var g;
	var r;
	var result;

	if (pix1 === 0) {
		return pix2;
	}
	if (pix2 === 0) {
		return pix1;
	}
	frac1 = 1024 - frac2;
	r = ((frac1 * ((pix1 >>> 16) & 255)) + (frac2 * ((pix2 >>> 16) & 255))) >> 10;
	g = ((frac1 * ((pix1 >>> 8) & 255)) + (frac2 * ((pix2 >>> 8) & 255))) >> 10;
	b = ((frac1 * (pix1 & 255)) + (frac2 * (pix2 & 255))) >> 10;
	result = ((r << 16) + (g << 8)) + b;
	if (result === 0) {
		result = 1;
	}
	return result;
}


/*	Answer the interpolated pixel value from the given bitmap at the given point. The x and y coordinates are fixed-point integers with 10 bits of fraction (i.e. they were multiplied by 1024, then truncated). If the given point is right on an edge, answer the nearest edge pixel value. If it is entirely outside of the image, answer 0 (transparent). */

function interpolatedFromxywidthheight(bitmap, xFixed, yFixed, w, h) {
	var bottomPix;
	var index;
	var topPix;
	var x;
	var xFrac;
	var y;
	var yFrac;

	x = xFixed >>> 10;
	if ((x < -1) || (x >= w)) {
		return 0;
	}
	y = yFixed >>> 10;
	if ((y < -1) || (y >= h)) {
		return 0;
	}
	xFrac = xFixed & 1023;
	if (x === -1) {
		x = 0;
		xFrac = 0;
	}
	if (x === (w - 1)) {
		xFrac = 0;
	}
	yFrac = yFixed & 1023;
	if (y === -1) {
		y = 0;
		yFrac = 0;
	}
	if (y === (h - 1)) {
		yFrac = 0;
	}

	/* for squeak: + 1 */

	index = (y * w) + x;
	topPix = bitmap[index] & 16777215;
	if (xFrac > 0) {
		topPix = interpolateandfrac(topPix, bitmap[index + 1] & 16777215, xFrac);
	}
	if (yFrac === 0) {
		return topPix;
	}

	/* for squeak: + 1 */

	index = ((y + 1) * w) + x;
	bottomPix = bitmap[index] & 16777215;
	if (xFrac > 0) {
		bottomPix = interpolateandfrac(bottomPix, bitmap[index + 1] & 16777215, xFrac);
	}
	return interpolateandfrac(topPix, bottomPix, yFrac);
}

function primitiveBlur() {
	var bTotal;
	var dX;
	var dY;
	var gTotal;
	var height;
	var in_;
	var inOop;
	var n;
	var out;
	var outOop;
	var outPix;
	var pix;
	var rTotal;
	var sz;
	var width;
	var x;
	var y;

	inOop = interpreterProxy.stackValue(2);
	outOop = interpreterProxy.stackValue(1);
	width = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	sz = SIZEOF(inOop);
	interpreterProxy.success(SIZEOF(outOop) === sz);
	if (interpreterProxy.failed()) {
		return null;
	}
	height = DIV(sz, width);
	for (y = 1; y <= (height - 2); y++) {
		for (x = 1; x <= (width - 2); x++) {
			n = (rTotal = (gTotal = (bTotal = 0)));
			for (dY = -1; dY <= 1; dY++) {
				for (dX = -1; dX <= 1; dX++) {

					/* add 1 when testing in Squeak */

					pix = in_[((y + dY) * width) + (x + dX)] & 16777215;
					if (pix !== 0) {

						/* skip transparent pixels */

						rTotal += (pix >>> 16) & 255;
						gTotal += (pix >>> 8) & 255;
						bTotal += pix & 255;
						++n;
					}
				}
			}
			if (n === 0) {
				outPix = 0;
			} else {
				outPix = (((DIV(rTotal, n)) << 16) + ((DIV(gTotal, n)) << 8)) + (DIV(bTotal, n));
			}
			out[(y * width) + x] = outPix;
		}
	}
	interpreterProxy.pop(3);
	return 0;
}

function primitiveBrightnessShift() {
	var b;
	var brightness;
	var g;
	var hue;
	var i;
	var in_;
	var inOop;
	var max;
	var min;
	var out;
	var outOop;
	var pix;
	var r;
	var saturation;
	var shift;
	var sz;

	inOop = interpreterProxy.stackValue(2);
	outOop = interpreterProxy.stackValue(1);
	shift = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	sz = SIZEOF(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	interpreterProxy.success(SIZEOF(outOop) === sz);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (i = 0; i <= (sz - 1); i++) {
		pix = in_[i] & 16777215;
		if (pix !== 0) {

			/* skip pixel values of 0 (transparent) */

			r = (pix >>> 16) & 255;
			g = (pix >>> 8) & 255;

			/* find min and max color components */

			b = pix & 255;
			max = (min = r);
			if (g > max) {
				max = g;
			}
			if (b > max) {
				max = b;
			}
			if (g < min) {
				min = g;
			}
			if (b < min) {
				min = b;
			}

			/* find current saturation and brightness with range 0 to 1000 */

			hue = hueFromRGBminmax(r, g, b, min, max);
			if (max === 0) {
				saturation = 0;
			} else {
				saturation = DIV(((max - min) * 1000), max);
			}

			/* compute new brigthness */

			brightness = DIV((max * 1000), 255);
			brightness += shift * 10;
			if (brightness > 1000) {
				brightness = 1000;
			}
			if (brightness < 0) {
				brightness = 0;
			}
			bitmapatputHsv(out, i, hue, saturation, brightness);
		}
	}
	interpreterProxy.pop(3);
	return 0;
}

function primitiveCondenseSound() {
	var count;
	var dst;
	var dstOop;
	var factor;
	var i;
	var j;
	var max;
	var src;
	var srcOop;
	var sz;
	var v;
	var _src = 0;
	var _dst = 0;

	srcOop = interpreterProxy.stackValue(2);
	dstOop = interpreterProxy.stackValue(1);
	factor = interpreterProxy.stackIntegerValue(0);
	interpreterProxy.success(interpreterProxy.isWords(srcOop));
	interpreterProxy.success(interpreterProxy.isWords(dstOop));
	count = DIV((2 * SIZEOF(srcOop)), factor);
	sz = 2 * SIZEOF(dstOop);
	interpreterProxy.success(sz >= count);
	if (interpreterProxy.failed()) {
		return null;
	}
	src = srcOop.wordsAsInt16Array();
	dst = dstOop.wordsAsInt16Array();
	for (i = 1; i <= count; i++) {
		max = 0;
		for (j = 1; j <= factor; j++) {
			v = src[_src++];
			if (v < 0) {
				v = 0 - v;
			}
			if (v > max) {
				max = v;
			}
		}
		dst[_dst++] = max;
	}
	interpreterProxy.pop(3);
	return 0;
}

function primitiveDoubleSize() {
	var baseIndex;
	var dstX;
	var dstY;
	var i;
	var in_;
	var inH;
	var inOop;
	var inW;
	var out;
	var outH;
	var outOop;
	var outW;
	var pix;
	var x;
	var y;

	inOop = interpreterProxy.stackValue(7);
	inW = interpreterProxy.stackIntegerValue(6);
	inH = interpreterProxy.stackIntegerValue(5);
	outOop = interpreterProxy.stackValue(4);
	outW = interpreterProxy.stackIntegerValue(3);
	outH = interpreterProxy.stackIntegerValue(2);
	dstX = interpreterProxy.stackIntegerValue(1);
	dstY = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	interpreterProxy.success((dstX + (2 * inW)) < outW);
	interpreterProxy.success((dstY + (2 * inH)) < outH);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (y = 0; y <= (inH - 1); y++) {
		baseIndex = ((dstY + (2 * y)) * outW) + dstX;
		for (x = 0; x <= (inW - 1); x++) {
			pix = in_[x + (y * inW)];
			i = baseIndex + (2 * x);
			out[i] = pix;
			out[i + 1] = pix;
			out[i + outW] = pix;
			out[(i + outW) + 1] = pix;
		}
	}
	interpreterProxy.pop(8);
	return 0;
}

function primitiveExtractChannel() {
	var dst;
	var dstOop;
	var i;
	var rightFlag;
	var src;
	var srcOop;
	var sz;
	var _src = 0;
	var _dst = 0;

	srcOop = interpreterProxy.stackValue(2);
	dstOop = interpreterProxy.stackValue(1);
	rightFlag = interpreterProxy.booleanValueOf(interpreterProxy.stackValue(0));
	interpreterProxy.success(interpreterProxy.isWords(srcOop));
	interpreterProxy.success(interpreterProxy.isWords(dstOop));
	sz = SIZEOF(srcOop);
	interpreterProxy.success(SIZEOF(dstOop) >= (sz >> 1));
	if (interpreterProxy.failed()) {
		return null;
	}
	src = srcOop.wordsAsInt16Array();
	dst = dstOop.wordsAsInt16Array();
	if (rightFlag) {
		_src++;
	}
	for (i = 1; i <= sz; i++) {
		dst[_dst++] = src[_src]; _src += 2;
	}
	interpreterProxy.pop(3);
	return 0;
}

function primitiveFisheye() {
	var ang;
	var centerX;
	var centerY;
	var dx;
	var dy;
	var height;
	var in_;
	var inOop;
	var out;
	var outOop;
	var pix;
	var power;
	var r;
	var scaledPower;
	var srcX;
	var srcY;
	var sz;
	var width;
	var x;
	var y;

	inOop = interpreterProxy.stackValue(3);
	outOop = interpreterProxy.stackValue(2);
	width = interpreterProxy.stackIntegerValue(1);
	power = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	sz = SIZEOF(inOop);
	interpreterProxy.success(SIZEOF(outOop) === sz);
	if (interpreterProxy.failed()) {
		return null;
	}
	height = DIV(sz, width);
	centerX = width >> 1;
	centerY = height >> 1;
	height = DIV(sz, width);
	centerX = width >> 1;
	centerY = height >> 1;
	scaledPower = power / 100.0;
	for (x = 0; x <= (width - 1); x++) {
		for (y = 0; y <= (height - 1); y++) {
			dx = (x - centerX) / centerX;
			dy = (y - centerY) / centerY;
			r = Math.pow(Math.sqrt((dx * dx) + (dy * dy)),scaledPower);
			if (r <= 1.0) {
				ang = Math.atan2(dy,dx);
				srcX = ((1024 * (centerX + ((r * Math.cos(ang)) * centerX)))|0);
				srcY = ((1024 * (centerY + ((r * Math.sin(ang)) * centerY)))|0);
			} else {
				srcX = 1024 * x;
				srcY = 1024 * y;
			}
			pix = interpolatedFromxywidthheight(in_, srcX, srcY, width, height);
			out[(y * width) + x] = pix;
		}
	}
	interpreterProxy.pop(4);
	return 0;
}

function primitiveHalfSizeAverage() {
	var b;
	var dstH;
	var dstIndex;
	var dstW;
	var dstX;
	var dstY;
	var g;
	var in_;
	var inH;
	var inW;
	var out;
	var outH;
	var outW;
	var pixel;
	var r;
	var srcIndex;
	var srcX;
	var srcY;
	var x;
	var y;

	in_ = checkedUnsignedIntPtrOf(interpreterProxy.stackValue(11));
	inW = interpreterProxy.stackIntegerValue(10);
	inH = interpreterProxy.stackIntegerValue(9);
	out = checkedUnsignedIntPtrOf(interpreterProxy.stackValue(8));
	outW = interpreterProxy.stackIntegerValue(7);
	outH = interpreterProxy.stackIntegerValue(6);
	srcX = interpreterProxy.stackIntegerValue(5);
	srcY = interpreterProxy.stackIntegerValue(4);
	dstX = interpreterProxy.stackIntegerValue(3);
	dstY = interpreterProxy.stackIntegerValue(2);
	dstW = interpreterProxy.stackIntegerValue(1);
	dstH = interpreterProxy.stackIntegerValue(0);
	interpreterProxy.success((srcX >= 0) && (srcY >= 0));
	interpreterProxy.success((srcX + (2 * dstW)) <= inW);
	interpreterProxy.success((srcY + (2 * dstH)) <= inH);
	interpreterProxy.success((dstX >= 0) && (dstY >= 0));
	interpreterProxy.success((dstX + dstW) <= outW);
	interpreterProxy.success((dstY + dstH) <= outH);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (y = 0; y <= (dstH - 1); y++) {
		srcIndex = (inW * (srcY + (2 * y))) + srcX;
		dstIndex = (outW * (dstY + y)) + dstX;
		for (x = 0; x <= (dstW - 1); x++) {
			pixel = in_[srcIndex];
			r = pixel & 16711680;
			g = pixel & 65280;
			b = pixel & 255;
			pixel = in_[srcIndex + 1];
			r += pixel & 16711680;
			g += pixel & 65280;
			b += pixel & 255;
			pixel = in_[srcIndex + inW];
			r += pixel & 16711680;
			g += pixel & 65280;
			b += pixel & 255;
			pixel = in_[(srcIndex + inW) + 1];
			r += pixel & 16711680;
			g += pixel & 65280;

			/* store combined RGB into target bitmap */

			b += pixel & 255;
			out[dstIndex] = (((r >>> 2) & 16711680) | (((g >>> 2) & 65280) | (b >>> 2)));
			srcIndex += 2;
			++dstIndex;
		}
	}
	interpreterProxy.pop(12);
	return 0;
}

function primitiveHalfSizeDiagonal() {
	var b;
	var dstH;
	var dstIndex;
	var dstW;
	var dstX;
	var dstY;
	var g;
	var in_;
	var inH;
	var inW;
	var out;
	var outH;
	var outW;
	var p1;
	var p2;
	var r;
	var srcIndex;
	var srcX;
	var srcY;
	var x;
	var y;

	in_ = checkedUnsignedIntPtrOf(interpreterProxy.stackValue(11));
	inW = interpreterProxy.stackIntegerValue(10);
	inH = interpreterProxy.stackIntegerValue(9);
	out = checkedUnsignedIntPtrOf(interpreterProxy.stackValue(8));
	outW = interpreterProxy.stackIntegerValue(7);
	outH = interpreterProxy.stackIntegerValue(6);
	srcX = interpreterProxy.stackIntegerValue(5);
	srcY = interpreterProxy.stackIntegerValue(4);
	dstX = interpreterProxy.stackIntegerValue(3);
	dstY = interpreterProxy.stackIntegerValue(2);
	dstW = interpreterProxy.stackIntegerValue(1);
	dstH = interpreterProxy.stackIntegerValue(0);
	interpreterProxy.success((srcX >= 0) && (srcY >= 0));
	interpreterProxy.success((srcX + (2 * dstW)) <= inW);
	interpreterProxy.success((srcY + (2 * dstH)) <= inH);
	interpreterProxy.success((dstX >= 0) && (dstY >= 0));
	interpreterProxy.success((dstX + dstW) <= outW);
	interpreterProxy.success((dstY + dstH) <= outH);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (y = 0; y <= (dstH - 1); y++) {
		srcIndex = (inW * (srcY + (2 * y))) + srcX;
		dstIndex = (outW * (dstY + y)) + dstX;
		for (x = 0; x <= (dstW - 1); x++) {
			p1 = in_[srcIndex];
			p2 = in_[(srcIndex + inW) + 1];
			r = (((p1 & 16711680) + (p2 & 16711680)) >>> 1) & 16711680;
			g = (((p1 & 65280) + (p2 & 65280)) >>> 1) & 65280;

			/* store combined RGB into target bitmap */

			b = ((p1 & 255) + (p2 & 255)) >>> 1;
			out[dstIndex] = (r | (g | b));
			srcIndex += 2;
			++dstIndex;
		}
	}
	interpreterProxy.pop(12);
	return 0;
}

function primitiveHueShift() {
	var b;
	var brightness;
	var g;
	var hue;
	var i;
	var in_;
	var inOop;
	var max;
	var min;
	var out;
	var outOop;
	var pix;
	var r;
	var saturation;
	var shift;
	var sz;

	inOop = interpreterProxy.stackValue(2);
	outOop = interpreterProxy.stackValue(1);
	shift = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	sz = SIZEOF(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	interpreterProxy.success(SIZEOF(outOop) === sz);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (i = 0; i <= (sz - 1); i++) {
		pix = in_[i] & 16777215;
		if (pix !== 0) {

			/* skip pixel values of 0 (transparent) */

			r = (pix >>> 16) & 255;
			g = (pix >>> 8) & 255;

			/* find min and max color components */

			b = pix & 255;
			max = (min = r);
			if (g > max) {
				max = g;
			}
			if (b > max) {
				max = b;
			}
			if (g < min) {
				min = g;
			}
			if (b < min) {
				min = b;
			}
			brightness = DIV((max * 1000), 255);
			if (max === 0) {
				saturation = 0;
			} else {
				saturation = DIV(((max - min) * 1000), max);
			}
			if (brightness < 110) {

				/* force black to a very dark, saturated gray */

				brightness = 110;
				saturation = 1000;
			}
			if (saturation < 90) {
				saturation = 90;
			}
			if ((brightness === 110) || (saturation === 90)) {

				/* tint all blacks and grays the same */

				hue = 0;
			} else {
				hue = hueFromRGBminmax(r, g, b, min, max);
			}

			/* compute new hue */

			hue = MOD(((hue + shift) + 360000000), 360);
			bitmapatputHsv(out, i, hue, saturation, brightness);
		}
	}
	interpreterProxy.pop(3);
	return 0;
}

function primitiveInterpolate() {
	var in_;
	var inOop;
	var result;
	var sz;
	var width;
	var xFixed;
	var yFixed;

	inOop = interpreterProxy.stackValue(3);
	width = interpreterProxy.stackIntegerValue(2);
	xFixed = interpreterProxy.stackIntegerValue(1);
	yFixed = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	sz = SIZEOF(inOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	result = interpolatedFromxywidthheight(in_, xFixed, yFixed, width, DIV(sz, width));
	interpreterProxy.pop(5);
	interpreterProxy.pushInteger(result);
	return 0;
}

function primitiveSaturationShift() {
	var b;
	var brightness;
	var g;
	var hue;
	var i;
	var in_;
	var inOop;
	var max;
	var min;
	var out;
	var outOop;
	var pix;
	var r;
	var saturation;
	var shift;
	var sz;

	inOop = interpreterProxy.stackValue(2);
	outOop = interpreterProxy.stackValue(1);
	shift = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	sz = SIZEOF(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	interpreterProxy.success(SIZEOF(outOop) === sz);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (i = 0; i <= (sz - 1); i++) {
		pix = in_[i] & 16777215;
		if (!(pix < 2)) {

			/* skip pixel values of 0 (transparent) and 1 (black) */

			r = (pix >>> 16) & 255;
			g = (pix >>> 8) & 255;

			/* find min and max color components */

			b = pix & 255;
			max = (min = r);
			if (g > max) {
				max = g;
			}
			if (b > max) {
				max = b;
			}
			if (g < min) {
				min = g;
			}
			if (b < min) {
				min = b;
			}
			brightness = DIV((max * 1000), 255);
			if (max === 0) {
				saturation = 0;
			} else {
				saturation = DIV(((max - min) * 1000), max);
			}
			if (saturation > 0) {

				/* do nothing if pixel is unsaturated (gray) */


				/* compute new saturation */

				hue = hueFromRGBminmax(r, g, b, min, max);
				saturation += shift * 10;
				if (saturation > 1000) {
					saturation = 1000;
				}
				if (saturation < 0) {
					saturation = 0;
				}
				bitmapatputHsv(out, i, hue, saturation, brightness);
			}
		}
	}
	interpreterProxy.pop(3);
	return 0;
}


/*	Scale using bilinear interpolation. */

function primitiveScale() {
	var in_;
	var inH;
	var inOop;
	var inW;
	var inX;
	var inY;
	var out;
	var outH;
	var outOop;
	var outPix;
	var outW;
	var outX;
	var outY;
	var p1;
	var p2;
	var p3;
	var p4;
	var t;
	var tWeight;
	var w1;
	var w2;
	var w3;
	var w4;
	var xIncr;
	var yIncr;

	inOop = interpreterProxy.stackValue(5);
	inW = interpreterProxy.stackIntegerValue(4);
	inH = interpreterProxy.stackIntegerValue(3);
	outOop = interpreterProxy.stackValue(2);
	outW = interpreterProxy.stackIntegerValue(1);
	outH = interpreterProxy.stackIntegerValue(0);
	interpreterProxy.success(SIZEOF(inOop) === (inW * inH));
	interpreterProxy.success(SIZEOF(outOop) === (outW * outH));
	in_ = checkedUnsignedIntPtrOf(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	if (interpreterProxy.failed()) {
		return null;
	}

	/* source x and y, scaled by 1024 */

	inX = (inY = 0);

	/* source x increment, scaled by 1024 */

	xIncr = DIV((inW * 1024), outW);

	/* source y increment, scaled by 1024 */

	yIncr = DIV((inH * 1024), outH);
	for (outY = 0; outY <= (outH - 1); outY++) {
		inX = 0;
		for (outX = 0; outX <= (outW - 1); outX++) {

			/* compute weights, scaled by 2^20 */

			w1 = (1024 - (inX & 1023)) * (1024 - (inY & 1023));
			w2 = (inX & 1023) * (1024 - (inY & 1023));
			w3 = (1024 - (inX & 1023)) * (inY & 1023);

			/* get source pixels */

			w4 = (inX & 1023) * (inY & 1023);
			t = ((inY >>> 10) * inW) + (inX >>> 10);
			p1 = in_[t];
			if ((inX >>> 10) < (inW - 1)) {
				p2 = in_[t + 1];
			} else {
				p2 = p1;
			}
			if ((inY >>> 10) < (inH - 1)) {
				t += inW;
			}
			p3 = in_[t];
			if ((inX >>> 10) < (inW - 1)) {
				p4 = in_[t + 1];
			} else {
				p4 = p3;
			}
			tWeight = 0;
			if (p1 === 0) {
				p1 = p2;
				tWeight += w1;
			}
			if (p2 === 0) {
				p2 = p1;
				tWeight += w2;
			}
			if (p3 === 0) {
				p3 = p4;
				tWeight += w3;
			}
			if (p4 === 0) {
				p4 = p3;
				tWeight += w4;
			}
			if (p1 === 0) {
				p1 = p3;
				p2 = p4;
			}
			if (p3 === 0) {
				p3 = p1;
				p4 = p2;
			}
			outPix = 0;
			if (tWeight < 500000) {

				/* compute an (opaque) output pixel if less than 50% transparent */

				t = (((w1 * ((p1 >>> 16) & 255)) + (w2 * ((p2 >>> 16) & 255))) + (w3 * ((p3 >>> 16) & 255))) + (w4 * ((p4 >>> 16) & 255));
				outPix = ((t >>> 20) & 255) << 16;
				t = (((w1 * ((p1 >>> 8) & 255)) + (w2 * ((p2 >>> 8) & 255))) + (w3 * ((p3 >>> 8) & 255))) + (w4 * ((p4 >>> 8) & 255));
				outPix = outPix | (((t >>> 20) & 255) << 8);
				t = (((w1 * (p1 & 255)) + (w2 * (p2 & 255))) + (w3 * (p3 & 255))) + (w4 * (p4 & 255));
				outPix = outPix | ((t >>> 20) & 255);
				if (outPix === 0) {
					outPix = 1;
				}
			}
			out[(outY * outW) + outX] = outPix;
			inX += xIncr;
		}
		inY += yIncr;
	}
	interpreterProxy.pop(6);
	return 0;
}

function primitiveWaterRipples1() {
	var aArOop;
	var aArray;
	var allPix;
	var bArOop;
	var bArray;
	var blops;
	var d;
	var dist;
	var dx;
	var dx2;
	var dy;
	var dy2;
	var f;
	var g;
	var h;
	var height;
	var i;
	var in_;
	var inOop;
	var j;
	var newLoc;
	var out;
	var outOop;
	var pix;
	var power;
	var q;
	var ripply;
	var t;
	var t1;
	var temp;
	var val;
	var val2;
	var width;
	var x;
	var y;

	inOop = interpreterProxy.stackValue(5);
	outOop = interpreterProxy.stackValue(4);
	width = interpreterProxy.stackIntegerValue(3);
	in_ = checkedUnsignedIntPtrOf(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	allPix = SIZEOF(inOop);
	ripply = interpreterProxy.stackIntegerValue(2);
	aArOop = interpreterProxy.stackValue(1);
	bArOop = interpreterProxy.stackValue(0);
	aArray = checkedFloatPtrOf(aArOop);
	bArray = checkedFloatPtrOf(bArOop);
	interpreterProxy.success(SIZEOF(outOop) === allPix);
	if (interpreterProxy.failed()) {
		return null;
	}
	height = DIV(allPix, width);
	t1 = Math.random();
	blops = (MOD(t1, ripply)) - 1;
	for (t = 0; t <= ((blops / 2) - 1); t++) {
		t1 = Math.random();
		x = MOD(t1, width);
		t1 = Math.random();
		y = MOD(t1, height);
		t1 = Math.random();
		power = MOD(t1, 8);
		for (g = -4; g <= 4; g++) {
			for (h = -4; h <= 4; h++) {
				dist = ((g * g) + (h * h));
				if ((dist < 25) && (dist > 0)) {
					dx = ((x + g)|0);
					dy = ((y + h)|0);
					if ((dx > 0) && ((dy > 0) && ((dy < height) && (dx < width)))) {
						aArray[(dy * width) + dx] = (power * (1.0 - (dist / 25.0)));
					}
				}
			}
		}
	}
	for (f = 1; f <= (width - 2); f++) {
		for (d = 1; d <= (height - 2); d++) {
			val = (d * width) + f;
			aArray[val] = (((((((((bArray[val + 1] + bArray[val - 1]) + bArray[val + width]) + bArray[val - width]) + (bArray[(val - 1) - width] / 2)) + (bArray[(val - 1) + width] / 2)) + (bArray[(val + 1) - width] / 2)) + (bArray[(val + 1) + width] / 2)) / 4) - aArray[val]);
			aArray[val] = (aArray[val] * 0.9);
		}
	}
	for (q = 0; q <= (width * height); q++) {
		temp = bArray[q];
		bArray[q] = aArray[q];
		aArray[q] = temp;
	}
	for (j = 0; j <= (height - 1); j++) {
		for (i = 0; i <= (width - 1); i++) {
			if ((i > 1) && ((i < (width - 1)) && ((j > 1) && (j < (height - 1))))) {
				val2 = (j * width) + i;
				dx2 = (((aArray[val2] - aArray[val2 - 1]) + (aArray[val2 + 1] - aArray[val2])) * 64);
				dy2 = (((aArray[val2] - aArray[val2 - width]) + (aArray[val2 + width] - aArray[val2])) / 64);
				if (dx2 < 2) {
					dx2 = -2;
				}
				if (dx2 > 2) {
					dx2 = 2;
				}
				if (dy2 < 2) {
					dy2 = -2;
				}
				if (dy2 > 2) {
					dy2 = 2;
				}
				newLoc = ((((j + dy2) * width) + (i + dx2))|0);
				if ((newLoc < (width * height)) && (newLoc >= 0)) {
					pix = in_[newLoc];
				} else {
					pix = in_[i + (j * width)];
				}
			} else {
				pix = in_[i + (j * width)];
			}
			out[i + (j * width)] = pix;
		}
	}
	interpreterProxy.pop(6);
	return 0;
}

function primitiveWhirl() {
	var ang;
	var centerX;
	var centerY;
	var cosa;
	var d;
	var degrees;
	var dx;
	var dy;
	var factor;
	var height;
	var in_;
	var inOop;
	var out;
	var outOop;
	var pix;
	var radius;
	var radiusSquared;
	var scaleX;
	var scaleY;
	var sina;
	var sz;
	var whirlRadians;
	var width;
	var x;
	var y;

	inOop = interpreterProxy.stackValue(3);
	outOop = interpreterProxy.stackValue(2);
	width = interpreterProxy.stackIntegerValue(1);
	degrees = interpreterProxy.stackIntegerValue(0);
	in_ = checkedUnsignedIntPtrOf(inOop);
	out = checkedUnsignedIntPtrOf(outOop);
	sz = SIZEOF(inOop);
	interpreterProxy.success(SIZEOF(outOop) === sz);
	if (interpreterProxy.failed()) {
		return null;
	}
	height = DIV(sz, width);
	centerX = width >> 1;
	centerY = height >> 1;
	if (centerX < centerY) {
		radius = centerX;
		scaleX = centerY / centerX;
		scaleY = 1.0;
	} else {
		radius = centerY;
		scaleX = 1.0;
		if (centerY < centerX) {
			scaleY = centerX / centerY;
		} else {
			scaleY = 1.0;
		}
	}
	whirlRadians = (-3.141592653589793 * degrees) / 180.0;
	radiusSquared = (radius * radius);
	for (x = 0; x <= (width - 1); x++) {
		for (y = 0; y <= (height - 1); y++) {
			dx = scaleX * (x - centerX);
			dy = scaleY * (y - centerY);
			d = (dx * dx) + (dy * dy);
			if (d < radiusSquared) {

				/* inside the whirl circle */

				factor = 1.0 - (Math.sqrt(d) / radius);
				ang = whirlRadians * (factor * factor);
				sina = Math.sin(ang);
				cosa = Math.cos(ang);
				pix = interpolatedFromxywidthheight(in_, ((1024.0 * ((((cosa * dx) - (sina * dy)) / scaleX) + centerX))|0), ((1024.0 * ((((sina * dx) + (cosa * dy)) / scaleY) + centerY))|0), width, height);
				out[(width * y) + x] = pix;
			}
		}
	}
	interpreterProxy.pop(4);
	return 0;
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


Squeak.registerExternalModule("ScratchPlugin", {
	primitiveCondenseSound: primitiveCondenseSound,
	getModuleName: getModuleName,
	primitiveFisheye: primitiveFisheye,
	primitiveWaterRipples1: primitiveWaterRipples1,
	primitiveHalfSizeDiagonal: primitiveHalfSizeDiagonal,
	primitiveScale: primitiveScale,
	primitiveDoubleSize: primitiveDoubleSize,
	setInterpreter: setInterpreter,
	primitiveWhirl: primitiveWhirl,
	primitiveBlur: primitiveBlur,
	primitiveBrightnessShift: primitiveBrightnessShift,
	primitiveHalfSizeAverage: primitiveHalfSizeAverage,
	primitiveSaturationShift: primitiveSaturationShift,
	primitiveHueShift: primitiveHueShift,
	primitiveInterpolate: primitiveInterpolate,
	primitiveExtractChannel: primitiveExtractChannel,
});

}); // end of module

/***** including ../plugins/SoundGenerationPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:26 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	SoundGenerationPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.SoundGenerationPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Constants ***/
var IncrementFractionBits = 16;
var LoopIndexFractionMask = 511;
var LoopIndexScaleFactor = 512;
var ScaleFactor = 32768;
var ScaledIndexOverflow = 536870912;

/*** Variables ***/
var interpreterProxy = null;
var moduleName = "SoundGenerationPlugin 3 November 2014 (e)";



/*	Note: This is coded so that plugins can be run from Squeak. */

function getInterpreter() {
	return interpreterProxy;
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}

function msg(s) {
	console.log(moduleName + ": " + s);
}

function primitiveApplyReverb() {
	var rcvr;
	var aSoundBuffer;
	var startIndex;
	var n;
	var delayedLeft;
	var delayedRight;
	var i;
	var j;
	var out;
	var sliceIndex;
	var tapGain;
	var tapIndex;
	var bufferIndex;
	var bufferSize;
	var leftBuffer;
	var rightBuffer;
	var tapCount;
	var tapDelays;
	var tapGains;

	rcvr = interpreterProxy.stackValue(3);
	aSoundBuffer = interpreterProxy.stackInt16Array(2);
	startIndex = interpreterProxy.stackIntegerValue(1);
	n = interpreterProxy.stackIntegerValue(0);
	tapDelays = interpreterProxy.fetchInt32ArrayofObject(7, rcvr);
	tapGains = interpreterProxy.fetchInt32ArrayofObject(8, rcvr);
	tapCount = interpreterProxy.fetchIntegerofObject(9, rcvr);
	bufferSize = interpreterProxy.fetchIntegerofObject(10, rcvr);
	bufferIndex = interpreterProxy.fetchIntegerofObject(11, rcvr);
	leftBuffer = interpreterProxy.fetchInt16ArrayofObject(12, rcvr);
	rightBuffer = interpreterProxy.fetchInt16ArrayofObject(13, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (sliceIndex = startIndex; sliceIndex <= ((startIndex + n) - 1); sliceIndex++) {
		delayedLeft = (delayedRight = 0);
		for (tapIndex = 1; tapIndex <= tapCount; tapIndex++) {
			i = bufferIndex - tapDelays[tapIndex - 1];
			if (i < 1) {
				i += bufferSize;
			}
			tapGain = tapGains[tapIndex - 1];
			delayedLeft += tapGain * leftBuffer[i - 1];
			delayedRight += tapGain * rightBuffer[i - 1];
		}
		j = (2 * sliceIndex) - 1;
		out = aSoundBuffer[j - 1] + (delayedLeft >> 15);
		if (out > 32767) {
			out = 32767;
		}
		if (out < -32767) {
			out = -32767;
		}
		aSoundBuffer[j - 1] = out;
		leftBuffer[bufferIndex - 1] = out;
		++j;
		out = aSoundBuffer[j - 1] + (delayedRight >> 15);
		if (out > 32767) {
			out = 32767;
		}
		if (out < -32767) {
			out = -32767;
		}
		aSoundBuffer[j - 1] = out;
		rightBuffer[bufferIndex - 1] = out;
		bufferIndex = (MOD(bufferIndex, bufferSize)) + 1;
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(11, rcvr, bufferIndex);
	interpreterProxy.pop(3);
}


/*	Play samples from a wave table by stepping a fixed amount through the table on every sample. The table index and increment are scaled to allow fractional increments for greater pitch accuracy. */
/*	(FMSound pitch: 440.0 dur: 1.0 loudness: 0.5) play */

function primitiveMixFMSound() {
	var rcvr;
	var n;
	var aSoundBuffer;
	var startIndex;
	var leftVol;
	var rightVol;
	var doingFM;
	var i;
	var lastIndex;
	var offset;
	var s;
	var sample;
	var sliceIndex;
	var count;
	var normalizedModulation;
	var scaledIndex;
	var scaledIndexIncr;
	var scaledOffsetIndex;
	var scaledOffsetIndexIncr;
	var scaledVol;
	var scaledVolIncr;
	var scaledVolLimit;
	var scaledWaveTableSize;
	var waveTable;

	rcvr = interpreterProxy.stackValue(5);
	n = interpreterProxy.stackIntegerValue(4);
	aSoundBuffer = interpreterProxy.stackInt16Array(3);
	startIndex = interpreterProxy.stackIntegerValue(2);
	leftVol = interpreterProxy.stackIntegerValue(1);
	rightVol = interpreterProxy.stackIntegerValue(0);
	scaledVol = interpreterProxy.fetchIntegerofObject(3, rcvr);
	scaledVolIncr = interpreterProxy.fetchIntegerofObject(4, rcvr);
	scaledVolLimit = interpreterProxy.fetchIntegerofObject(5, rcvr);
	count = interpreterProxy.fetchIntegerofObject(7, rcvr);
	waveTable = interpreterProxy.fetchInt16ArrayofObject(8, rcvr);
	scaledWaveTableSize = interpreterProxy.fetchIntegerofObject(9, rcvr);
	scaledIndex = interpreterProxy.fetchIntegerofObject(10, rcvr);
	scaledIndexIncr = interpreterProxy.fetchIntegerofObject(11, rcvr);
	normalizedModulation = interpreterProxy.fetchIntegerofObject(14, rcvr);
	scaledOffsetIndex = interpreterProxy.fetchIntegerofObject(15, rcvr);
	scaledOffsetIndexIncr = interpreterProxy.fetchIntegerofObject(16, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	doingFM = (normalizedModulation !== 0) && (scaledOffsetIndexIncr !== 0);
	lastIndex = (startIndex + n) - 1;
	for (sliceIndex = startIndex; sliceIndex <= lastIndex; sliceIndex++) {
		sample = (scaledVol * waveTable[scaledIndex >> 15]) >> 15;
		if (doingFM) {
			offset = normalizedModulation * waveTable[scaledOffsetIndex >> 15];
			scaledOffsetIndex = MOD((scaledOffsetIndex + scaledOffsetIndexIncr), scaledWaveTableSize);
			if (scaledOffsetIndex < 0) {
				scaledOffsetIndex += scaledWaveTableSize;
			}
			scaledIndex = MOD(((scaledIndex + scaledIndexIncr) + offset), scaledWaveTableSize);
			if (scaledIndex < 0) {
				scaledIndex += scaledWaveTableSize;
			}
		} else {
			scaledIndex = MOD((scaledIndex + scaledIndexIncr), scaledWaveTableSize);
		}
		if (leftVol > 0) {
			i = (2 * sliceIndex) - 1;
			s = aSoundBuffer[i - 1] + ((sample * leftVol) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		if (rightVol > 0) {
			i = 2 * sliceIndex;
			s = aSoundBuffer[i - 1] + ((sample * rightVol) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		if (scaledVolIncr !== 0) {
			scaledVol += scaledVolIncr;
			if (((scaledVolIncr > 0) && (scaledVol >= scaledVolLimit)) || ((scaledVolIncr < 0) && (scaledVol <= scaledVolLimit))) {

				/* reached the limit; stop incrementing */

				scaledVol = scaledVolLimit;
				scaledVolIncr = 0;
			}
		}
	}
	count -= n;
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(3, rcvr, scaledVol);
	interpreterProxy.storeIntegerofObjectwithValue(4, rcvr, scaledVolIncr);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, count);
	interpreterProxy.storeIntegerofObjectwithValue(10, rcvr, scaledIndex);
	interpreterProxy.storeIntegerofObjectwithValue(15, rcvr, scaledOffsetIndex);
	interpreterProxy.pop(5);
}


/*	Play samples from a wave table by stepping a fixed amount through the table on every sample. The table index and increment are scaled to allow fractional increments for greater pitch accuracy.  If a loop length is specified, then the index is looped back when the loopEnd index is reached until count drops below releaseCount. This allows a short sampled sound to be sustained indefinitely. */
/*	(LoopedSampledSound pitch: 440.0 dur: 5.0 loudness: 0.5) play */

function primitiveMixLoopedSampledSound() {
	var rcvr;
	var n;
	var aSoundBuffer;
	var startIndex;
	var leftVol;
	var rightVol;
	var compositeLeftVol;
	var compositeRightVol;
	var i;
	var isInStereo;
	var lastIndex;
	var leftVal;
	var m;
	var nextSampleIndex;
	var rightVal;
	var s;
	var sampleIndex;
	var sliceIndex;
	var count;
	var lastSample;
	var leftSamples;
	var loopEnd;
	var releaseCount;
	var rightSamples;
	var scaledIndex;
	var scaledIndexIncr;
	var scaledLoopLength;
	var scaledVol;
	var scaledVolIncr;
	var scaledVolLimit;

	rcvr = interpreterProxy.stackValue(5);
	n = interpreterProxy.stackIntegerValue(4);
	aSoundBuffer = interpreterProxy.stackInt16Array(3);
	startIndex = interpreterProxy.stackIntegerValue(2);
	leftVol = interpreterProxy.stackIntegerValue(1);
	rightVol = interpreterProxy.stackIntegerValue(0);
	scaledVol = interpreterProxy.fetchIntegerofObject(3, rcvr);
	scaledVolIncr = interpreterProxy.fetchIntegerofObject(4, rcvr);
	scaledVolLimit = interpreterProxy.fetchIntegerofObject(5, rcvr);
	count = interpreterProxy.fetchIntegerofObject(7, rcvr);
	releaseCount = interpreterProxy.fetchIntegerofObject(8, rcvr);
	leftSamples = interpreterProxy.fetchInt16ArrayofObject(10, rcvr);
	rightSamples = interpreterProxy.fetchInt16ArrayofObject(11, rcvr);
	lastSample = interpreterProxy.fetchIntegerofObject(16, rcvr);
	loopEnd = interpreterProxy.fetchIntegerofObject(17, rcvr);
	scaledLoopLength = interpreterProxy.fetchIntegerofObject(18, rcvr);
	scaledIndex = interpreterProxy.fetchIntegerofObject(19, rcvr);
	scaledIndexIncr = interpreterProxy.fetchIntegerofObject(20, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	isInStereo = leftSamples !== rightSamples;
	compositeLeftVol = (leftVol * scaledVol) >> 15;
	compositeRightVol = (rightVol * scaledVol) >> 15;
	i = (2 * startIndex) - 1;
	lastIndex = (startIndex + n) - 1;
	for (sliceIndex = startIndex; sliceIndex <= lastIndex; sliceIndex++) {
		sampleIndex = ((scaledIndex += scaledIndexIncr)) >> 9;
		if ((sampleIndex > loopEnd) && (count > releaseCount)) {

			/* loop back if not within releaseCount of the note end */
			/* note: unlooped sounds will have loopEnd = lastSample */

			sampleIndex = ((scaledIndex -= scaledLoopLength)) >> 9;
		}
		if (((nextSampleIndex = sampleIndex + 1)) > lastSample) {
			if (sampleIndex > lastSample) {
				count = 0;
				if (interpreterProxy.failed()) {
					return null;
				}
				interpreterProxy.storeIntegerofObjectwithValue(3, rcvr, scaledVol);
				interpreterProxy.storeIntegerofObjectwithValue(4, rcvr, scaledVolIncr);
				interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, count);
				interpreterProxy.storeIntegerofObjectwithValue(19, rcvr, scaledIndex);
				interpreterProxy.popthenPush(6, null);
				return null;
			}
			if (scaledLoopLength === 0) {
				nextSampleIndex = sampleIndex;
			} else {
				nextSampleIndex = ((scaledIndex - scaledLoopLength) >> 9) + 1;
			}
		}
		m = scaledIndex & LoopIndexFractionMask;
		rightVal = (leftVal = ((leftSamples[sampleIndex - 1] * (LoopIndexScaleFactor - m)) + (leftSamples[nextSampleIndex - 1] * m)) >> 9);
		if (isInStereo) {
			rightVal = ((rightSamples[sampleIndex - 1] * (LoopIndexScaleFactor - m)) + (rightSamples[nextSampleIndex - 1] * m)) >> 9;
		}
		if (leftVol > 0) {
			s = aSoundBuffer[i - 1] + ((compositeLeftVol * leftVal) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		++i;
		if (rightVol > 0) {
			s = aSoundBuffer[i - 1] + ((compositeRightVol * rightVal) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		++i;
		if (scaledVolIncr !== 0) {

			/* update volume envelope if it is changing */

			scaledVol += scaledVolIncr;
			if (((scaledVolIncr > 0) && (scaledVol >= scaledVolLimit)) || ((scaledVolIncr < 0) && (scaledVol <= scaledVolLimit))) {

				/* reached the limit; stop incrementing */

				scaledVol = scaledVolLimit;
				scaledVolIncr = 0;
			}
			compositeLeftVol = (leftVol * scaledVol) >> 15;
			compositeRightVol = (rightVol * scaledVol) >> 15;
		}
	}
	count -= n;
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(3, rcvr, scaledVol);
	interpreterProxy.storeIntegerofObjectwithValue(4, rcvr, scaledVolIncr);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, count);
	interpreterProxy.storeIntegerofObjectwithValue(19, rcvr, scaledIndex);
	interpreterProxy.pop(5);
}


/*	The Karplus-Strong plucked string algorithm: start with a buffer full of random noise and repeatedly play the contents of that buffer while averaging adjacent samples. High harmonics damp out more quickly, transfering their energy to lower ones. The length of the buffer corresponds to the length of the string. */
/*	(PluckedSound pitch: 220.0 dur: 6.0 loudness: 0.8) play */

function primitiveMixPluckedSound() {
	var rcvr;
	var n;
	var aSoundBuffer;
	var startIndex;
	var leftVol;
	var rightVol;
	var average;
	var i;
	var lastIndex;
	var s;
	var sample;
	var scaledNextIndex;
	var scaledThisIndex;
	var sliceIndex;
	var count;
	var ring;
	var scaledIndex;
	var scaledIndexIncr;
	var scaledIndexLimit;
	var scaledVol;
	var scaledVolIncr;
	var scaledVolLimit;

	rcvr = interpreterProxy.stackValue(5);
	n = interpreterProxy.stackIntegerValue(4);
	aSoundBuffer = interpreterProxy.stackInt16Array(3);
	startIndex = interpreterProxy.stackIntegerValue(2);
	leftVol = interpreterProxy.stackIntegerValue(1);
	rightVol = interpreterProxy.stackIntegerValue(0);
	scaledVol = interpreterProxy.fetchIntegerofObject(3, rcvr);
	scaledVolIncr = interpreterProxy.fetchIntegerofObject(4, rcvr);
	scaledVolLimit = interpreterProxy.fetchIntegerofObject(5, rcvr);
	count = interpreterProxy.fetchIntegerofObject(7, rcvr);
	ring = interpreterProxy.fetchInt16ArrayofObject(8, rcvr);
	scaledIndex = interpreterProxy.fetchIntegerofObject(9, rcvr);
	scaledIndexIncr = interpreterProxy.fetchIntegerofObject(10, rcvr);
	scaledIndexLimit = interpreterProxy.fetchIntegerofObject(11, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	lastIndex = (startIndex + n) - 1;
	scaledThisIndex = (scaledNextIndex = scaledIndex);
	for (sliceIndex = startIndex; sliceIndex <= lastIndex; sliceIndex++) {
		scaledNextIndex = scaledThisIndex + scaledIndexIncr;
		if (scaledNextIndex >= scaledIndexLimit) {
			scaledNextIndex = ScaleFactor + (scaledNextIndex - scaledIndexLimit);
		}
		average = (ring[(scaledThisIndex >> 15) - 1] + ring[(scaledNextIndex >> 15) - 1]) >> 1;
		ring[(scaledThisIndex >> 15) - 1] = average;

		/* scale by volume */

		sample = (average * scaledVol) >> 15;
		scaledThisIndex = scaledNextIndex;
		if (leftVol > 0) {
			i = (2 * sliceIndex) - 1;
			s = aSoundBuffer[i - 1] + ((sample * leftVol) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		if (rightVol > 0) {
			i = 2 * sliceIndex;
			s = aSoundBuffer[i - 1] + ((sample * rightVol) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		if (scaledVolIncr !== 0) {
			scaledVol += scaledVolIncr;
			if (((scaledVolIncr > 0) && (scaledVol >= scaledVolLimit)) || ((scaledVolIncr < 0) && (scaledVol <= scaledVolLimit))) {

				/* reached the limit; stop incrementing */

				scaledVol = scaledVolLimit;
				scaledVolIncr = 0;
			}
		}
	}
	scaledIndex = scaledNextIndex;
	count -= n;
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(3, rcvr, scaledVol);
	interpreterProxy.storeIntegerofObjectwithValue(4, rcvr, scaledVolIncr);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, count);
	interpreterProxy.storeIntegerofObjectwithValue(9, rcvr, scaledIndex);
	interpreterProxy.pop(5);
}


/*	Mix the given number of samples with the samples already in the given buffer starting at the given index. Assume that the buffer size is at least (index + count) - 1. */

function primitiveMixSampledSound() {
	var rcvr;
	var n;
	var aSoundBuffer;
	var startIndex;
	var leftVol;
	var rightVol;
	var i;
	var lastIndex;
	var outIndex;
	var overflow;
	var s;
	var sample;
	var sampleIndex;
	var count;
	var indexHighBits;
	var samples;
	var samplesSize;
	var scaledIncrement;
	var scaledIndex;
	var scaledVol;
	var scaledVolIncr;
	var scaledVolLimit;

	rcvr = interpreterProxy.stackValue(5);
	n = interpreterProxy.stackIntegerValue(4);
	aSoundBuffer = interpreterProxy.stackInt16Array(3);
	startIndex = interpreterProxy.stackIntegerValue(2);
	leftVol = interpreterProxy.stackIntegerValue(1);
	rightVol = interpreterProxy.stackIntegerValue(0);
	scaledVol = interpreterProxy.fetchIntegerofObject(3, rcvr);
	scaledVolIncr = interpreterProxy.fetchIntegerofObject(4, rcvr);
	scaledVolLimit = interpreterProxy.fetchIntegerofObject(5, rcvr);
	count = interpreterProxy.fetchIntegerofObject(7, rcvr);
	samples = interpreterProxy.fetchInt16ArrayofObject(8, rcvr);
	samplesSize = interpreterProxy.fetchIntegerofObject(10, rcvr);
	scaledIndex = interpreterProxy.fetchIntegerofObject(11, rcvr);
	indexHighBits = interpreterProxy.fetchIntegerofObject(12, rcvr);
	scaledIncrement = interpreterProxy.fetchIntegerofObject(13, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	lastIndex = (startIndex + n) - 1;

	/* index of next stereo output sample pair */

	outIndex = startIndex;
	sampleIndex = indexHighBits + (scaledIndex >>> 16);
	while ((sampleIndex <= samplesSize) && (outIndex <= lastIndex)) {
		sample = (samples[sampleIndex - 1] * scaledVol) >> 15;
		if (leftVol > 0) {
			i = (2 * outIndex) - 1;
			s = aSoundBuffer[i - 1] + ((sample * leftVol) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		if (rightVol > 0) {
			i = 2 * outIndex;
			s = aSoundBuffer[i - 1] + ((sample * rightVol) >> 15);
			if (s > 32767) {
				s = 32767;
			}
			if (s < -32767) {
				s = -32767;
			}
			aSoundBuffer[i - 1] = s;
		}
		if (scaledVolIncr !== 0) {
			scaledVol += scaledVolIncr;
			if (((scaledVolIncr > 0) && (scaledVol >= scaledVolLimit)) || ((scaledVolIncr < 0) && (scaledVol <= scaledVolLimit))) {

				/* reached the limit; stop incrementing */

				scaledVol = scaledVolLimit;
				scaledVolIncr = 0;
			}
		}
		scaledIndex += scaledIncrement;
		if (scaledIndex >= ScaledIndexOverflow) {
			overflow = scaledIndex >>> 16;
			indexHighBits += overflow;
			scaledIndex -= overflow << 16;
		}
		sampleIndex = indexHighBits + (scaledIndex >>> 16);
		++outIndex;
	}
	count -= n;
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(3, rcvr, scaledVol);
	interpreterProxy.storeIntegerofObjectwithValue(4, rcvr, scaledVolIncr);
	interpreterProxy.storeIntegerofObjectwithValue(7, rcvr, count);
	interpreterProxy.storeIntegerofObjectwithValue(11, rcvr, scaledIndex);
	interpreterProxy.storeIntegerofObjectwithValue(12, rcvr, indexHighBits);
	interpreterProxy.pop(5);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


Squeak.registerExternalModule("SoundGenerationPlugin", {
	primitiveMixFMSound: primitiveMixFMSound,
	primitiveMixSampledSound: primitiveMixSampledSound,
	setInterpreter: setInterpreter,
	getModuleName: getModuleName,
	primitiveApplyReverb: primitiveApplyReverb,
	primitiveMixPluckedSound: primitiveMixPluckedSound,
	primitiveMixLoopedSampledSound: primitiveMixLoopedSampledSound,
});

}); // end of module

/***** including ../plugins/StarSqueakPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:26 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	StarSqueakPlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.StarSqueakPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Variables ***/
var interpreterProxy = null;
var moduleName = "StarSqueakPlugin 3 November 2014 (e)";



/*	Return an unsigned int pointer to the first indexable word of oop, which must be a words object. */

function checkedUnsignedIntPtrOf(oop) {
	interpreterProxy.success(interpreterProxy.isWords(oop));
	if (interpreterProxy.failed()) {
		return 0;
	}
	return oop.words;
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}


/*	Diffuse the integer values of the source patch variable Bitmap into the output Bitmap. Each cell of the output is the average of the NxN area around it in the source, where N = (2 * delta) + 1. */

function primitiveDiffuseFromToWidthHeightDelta() {
	var area;
	var delta;
	var dst;
	var dstOop;
	var endX;
	var endY;
	var height;
	var rowStart;
	var src;
	var srcOop;
	var startX;
	var startY;
	var sum;
	var width;
	var x;
	var x2;
	var y;
	var y2;

	srcOop = interpreterProxy.stackValue(4);
	dstOop = interpreterProxy.stackValue(3);
	width = interpreterProxy.stackIntegerValue(2);
	height = interpreterProxy.stackIntegerValue(1);
	delta = interpreterProxy.stackIntegerValue(0);
	src = checkedUnsignedIntPtrOf(srcOop);
	dst = checkedUnsignedIntPtrOf(dstOop);
	interpreterProxy.success(SIZEOF(srcOop) === SIZEOF(dstOop));
	interpreterProxy.success(SIZEOF(srcOop) === (width * height));
	if (interpreterProxy.failed()) {
		return null;
	}
	area = ((2 * delta) + 1) * ((2 * delta) + 1);
	for (y = 0; y <= (height - 1); y++) {
		startY = y - delta;
		if (startY < 0) {
			startY = 0;
		}
		endY = y + delta;
		if (endY >= height) {
			endY = height - 1;
		}
		for (x = 0; x <= (width - 1); x++) {
			startX = x - delta;
			if (startX < 0) {
				startX = 0;
			}
			endX = x + delta;
			if (endX >= width) {
				endX = width - 1;
			}
			sum = 0;
			for (y2 = startY; y2 <= endY; y2++) {
				rowStart = y2 * width;
				for (x2 = startX; x2 <= endX; x2++) {
					sum += src[rowStart + x2];
				}
			}
			dst[(y * width) + x] = (DIV(sum, area));
		}
	}
	interpreterProxy.pop(5);
}


/*	Evaporate the integer values of the source Bitmap at the given rate. The rate is an integer between 0 and 1024, where 1024 is a scale factor of 1.0 (i.e., no evaporation). */

function primitiveEvaporateRate() {
	var i;
	var patchVar;
	var patchVarOop;
	var rate;
	var sz;

	patchVarOop = interpreterProxy.stackValue(1);
	rate = interpreterProxy.stackIntegerValue(0);
	patchVar = checkedUnsignedIntPtrOf(patchVarOop);
	sz = SIZEOF(patchVarOop);
	if (interpreterProxy.failed()) {
		return null;
	}
	for (i = 0; i <= (sz - 1); i++) {
		patchVar[i] = ((patchVar[i] * rate) >>> 10);
	}
	interpreterProxy.pop(2);
}

function primitiveMapFromToWidthHeightPatchSizeRgbFlagsShift() {
	var dst;
	var dstIndex;
	var dstOop;
	var h;
	var level;
	var offset;
	var patchSize;
	var pixel;
	var rgbFlags;
	var rgbMult;
	var rowStart;
	var shiftAmount;
	var src;
	var srcIndex;
	var srcOop;
	var w;
	var x;
	var y;

	srcOop = interpreterProxy.stackValue(6);
	dstOop = interpreterProxy.stackValue(5);
	w = interpreterProxy.stackIntegerValue(4);
	h = interpreterProxy.stackIntegerValue(3);
	patchSize = interpreterProxy.stackIntegerValue(2);
	rgbFlags = interpreterProxy.stackIntegerValue(1);
	shiftAmount = interpreterProxy.stackIntegerValue(0);
	src = checkedUnsignedIntPtrOf(srcOop);
	dst = checkedUnsignedIntPtrOf(dstOop);
	interpreterProxy.success(SIZEOF(dstOop) === (w * h));
	interpreterProxy.success(SIZEOF(dstOop) === ((SIZEOF(srcOop) * patchSize) * patchSize));
	if (interpreterProxy.failed()) {
		return null;
	}
	rgbMult = 0;
	if ((rgbFlags & 4) > 0) {
		rgbMult += 65536;
	}
	if ((rgbFlags & 2) > 0) {
		rgbMult += 256;
	}
	if ((rgbFlags & 1) > 0) {
		++rgbMult;
	}
	srcIndex = -1;
	for (y = 0; y <= ((DIV(h, patchSize)) - 1); y++) {
		for (x = 0; x <= ((DIV(w, patchSize)) - 1); x++) {
			level = SHIFT(src[(++srcIndex)], shiftAmount);
			if (level > 255) {
				level = 255;
			}
			if (level <= 0) {

				/* non-transparent black */

				pixel = 1;
			} else {
				pixel = level * rgbMult;
			}
			offset = ((y * w) + x) * patchSize;
			for (rowStart = offset; rowStart <= (offset + ((patchSize - 1) * w)); rowStart += w) {
				for (dstIndex = rowStart; dstIndex <= ((rowStart + patchSize) - 1); dstIndex++) {
					dst[dstIndex] = pixel;
				}
			}
		}
	}
	interpreterProxy.pop(7);
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


Squeak.registerExternalModule("StarSqueakPlugin", {
	primitiveDiffuseFromToWidthHeightDelta: primitiveDiffuseFromToWidthHeightDelta,
	primitiveEvaporateRate: primitiveEvaporateRate,
	setInterpreter: setInterpreter,
	primitiveMapFromToWidthHeightPatchSizeRgbFlagsShift: primitiveMapFromToWidthHeightPatchSizeRgbFlagsShift,
	getModuleName: getModuleName,
});

}); // end of module

/***** including ../plugins/ZipPlugin.js *****/

/* Smalltalk from Squeak4.5 with VMMaker 4.13.6 translated as JS source on 3 November 2014 1:52:20 pm */
/* Automatically generated by
	JSPluginCodeGenerator VMMakerJS-bf.15 uuid: fd4e10f2-3773-4e80-8bb5-c4b471a014e5
   from
	DeflatePlugin VMMaker-bf.353 uuid: 8ae25e7e-8d2c-451e-8277-598b30e9c002
 */

module("users.bert.SqueakJS.plugins.ZipPlugin").requires("users.bert.SqueakJS.vm").toRun(function() {

var VM_PROXY_MAJOR = 1;
var VM_PROXY_MINOR = 11;

/*** Functions ***/
function CLASSOF(obj) { return typeof obj === "number" ? interpreterProxy.classSmallInteger() : obj.sqClass }
function SIZEOF(obj) { return obj.pointers ? obj.pointers.length : obj.words ? obj.words.length : obj.bytes ? obj.bytes.length : 0 }
function BYTESIZEOF(obj) { return obj.bytes ? obj.bytes.length : obj.words ? obj.words.length * 4 : 0 }
function DIV(a, b) { return Math.floor(a / b) | 0; }   // integer division
function MOD(a, b) { return a - DIV(a, b) * b | 0; }   // signed modulus
function SHL(a, b) { return b > 31 ? 0 : a << b; }     // fix JS shift
function SHR(a, b) { return b > 31 ? 0 : a >>> b; }    // fix JS shift
function SHIFT(a, b) { return b < 0 ? (b < -31 ? 0 : a >>> (0-b) ) : (b > 31 ? 0 : a << b); }

/*** Constants ***/
var DeflateHashMask = 32767;
var DeflateHashShift = 5;
var DeflateHashTableSize = 32768;
var DeflateMaxDistance = 32768;
var DeflateMaxDistanceCodes = 30;
var DeflateMaxLiteralCodes = 286;
var DeflateMaxMatch = 258;
var DeflateMinMatch = 3;
var DeflateWindowMask = 32767;
var DeflateWindowSize = 32768;
var MaxBits = 16;
var StateNoMoreData = 1;

/*** Variables ***/
var interpreterProxy = null;
var moduleName = "ZipPlugin 3 November 2014 (e)";
var readStreamInstSize = 0;
var writeStreamInstSize = 0;
var zipBaseDistance = [
0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 
256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576];
var zipBaseLength = [
0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 
32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 0];
var zipBitBuf = 0;
var zipBitPos = 0;
var zipBlockPos = 0;
var zipBlockStart = 0;
var zipCollection = null;
var zipCollectionSize = 0;
var zipCrcTable = [
0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685, 2657392035, 249268274, 2044508324, 3772115230, 2547177864, 162941995, 2125561021, 3887607047, 2428444049, 
498536548, 1789927666, 4089016648, 2227061214, 450548861, 1843258603, 4107580753, 2211677639, 325883990, 1684777152, 4251122042, 2321926636, 335633487, 1661365465, 4195302755, 2366115317, 
997073096, 1281953886, 3579855332, 2724688242, 1006888145, 1258607687, 3524101629, 2768942443, 901097722, 1119000684, 3686517206, 2898065728, 853044451, 1172266101, 3705015759, 2882616665, 
651767980, 1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705, 3099436303, 671266974, 1594198024, 3322730930, 2970347812, 795835527, 1483230225, 3244367275, 3060149565, 
1994146192, 31158534, 2563907772, 4023717930, 1907459465, 112637215, 2680153253, 3904427059, 2013776290, 251722036, 2517215374, 3775830040, 2137656763, 141376813, 2439277719, 3865271297, 
1802195444, 476864866, 2238001368, 4066508878, 1812370925, 453092731, 2181625025, 4111451223, 1706088902, 314042704, 2344532202, 4240017532, 1658658271, 366619977, 2362670323, 4224994405, 
1303535960, 984961486, 2747007092, 3569037538, 1256170817, 1037604311, 2765210733, 3554079995, 1131014506, 879679996, 2909243462, 3663771856, 1141124467, 855842277, 2852801631, 3708648649, 
1342533948, 654459306, 3188396048, 3373015174, 1466479909, 544179635, 3110523913, 3462522015, 1591671054, 702138776, 2966460450, 3352799412, 1504918807, 783551873, 3082640443, 3233442989, 
3988292384, 2596254646, 62317068, 1957810842, 3939845945, 2647816111, 81470997, 1943803523, 3814918930, 2489596804, 225274430, 2053790376, 3826175755, 2466906013, 167816743, 2097651377, 
4027552580, 2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225, 1852507879, 4275313526, 2312317920, 282753626, 1742555852, 4189708143, 2394877945, 397917763, 1622183637, 
3604390888, 2714866558, 953729732, 1340076626, 3518719985, 2797360999, 1068828381, 1219638859, 3624741850, 2936675148, 906185462, 1090812512, 3747672003, 2825379669, 829329135, 1181335161, 
3412177804, 3160834842, 628085408, 1382605366, 3423369109, 3138078467, 570562233, 1426400815, 3317316542, 2998733608, 733239954, 1555261956, 3268935591, 3050360625, 752459403, 1541320221, 
2607071920, 3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877, 83908371, 2512341634, 3803740692, 2075208622, 213261112, 2463272603, 3855990285, 2094854071, 198958881, 
2262029012, 4057260610, 1759359992, 534414190, 2176718541, 4139329115, 1873836001, 414664567, 2282248934, 4279200368, 1711684554, 285281116, 2405801727, 4167216745, 1634467795, 376229701, 
2685067896, 3608007406, 1308918612, 956543938, 2808555105, 3495958263, 1231636301, 1047427035, 2932959818, 3654703836, 1088359270, 936918000, 2847714899, 3736837829, 1202900863, 817233897, 
3183342108, 3401237130, 1404277552, 615818150, 3134207493, 3453421203, 1423857449, 601450431, 3009837614, 3294710456, 1567103746, 711928724, 3020668471, 3272380065, 1510334235, 755167117];
var zipDistTable = null;
var zipDistTableSize = 0;
var zipDistanceCodes = [
0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 
8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9, 
10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 
11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 
12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 
12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 
13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 
13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 
14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 
14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 
14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 
14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 
15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 
15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 
15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 
15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 
0, 0, 16, 17, 18, 18, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 
22, 22, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 
24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 
25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 
26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 
26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 
27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 
27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 
28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 
28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 
28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 
28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 
29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 
29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 
29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 
29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29];
var zipDistanceFreq = null;
var zipDistances = null;
var zipExtraDistanceBits = [
0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 
7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
var zipExtraLengthBits = [
0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 
3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
var zipHashHead = null;
var zipHashTail = null;
var zipHashValue = 0;
var zipLitTable = null;
var zipLitTableSize = 0;
var zipLiteralCount = 0;
var zipLiteralFreq = null;
var zipLiteralSize = 0;
var zipLiterals = null;
var zipMatchCount = 0;
var zipMatchLengthCodes = [
257, 258, 259, 260, 261, 262, 263, 264, 265, 265, 266, 266, 267, 267, 268, 268, 
269, 269, 269, 269, 270, 270, 270, 270, 271, 271, 271, 271, 272, 272, 272, 272, 
273, 273, 273, 273, 273, 273, 273, 273, 274, 274, 274, 274, 274, 274, 274, 274, 
275, 275, 275, 275, 275, 275, 275, 275, 276, 276, 276, 276, 276, 276, 276, 276, 
277, 277, 277, 277, 277, 277, 277, 277, 277, 277, 277, 277, 277, 277, 277, 277, 
278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 
279, 279, 279, 279, 279, 279, 279, 279, 279, 279, 279, 279, 279, 279, 279, 279, 
280, 280, 280, 280, 280, 280, 280, 280, 280, 280, 280, 280, 280, 280, 280, 280, 
281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 
281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 281, 
282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 
282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 282, 
283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 
283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 283, 
284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 
284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284, 284];
var zipPosition = 0;
var zipReadLimit = 0;
var zipSource = null;
var zipSourceLimit = 0;
var zipSourcePos = 0;
var zipState = 0;



/*	Compare the two strings and return the length of matching characters.
	minLength is a lower bound for match lengths that will be accepted.
	Note: here and matchPos are zero based. */

function comparewithmin(here, matchPos, minLength) {
	var length;


	/* First test if we can actually get longer than minLength */

	if (zipCollection[here + minLength] !== zipCollection[matchPos + minLength]) {
		return 0;
	}
	if (zipCollection[(here + minLength) - 1] !== zipCollection[(matchPos + minLength) - 1]) {
		return 0;
	}
	if (zipCollection[here] !== zipCollection[matchPos]) {
		return 0;
	}
	if (zipCollection[here + 1] !== zipCollection[matchPos + 1]) {
		return 1;
	}
	length = 2;
	while ((length < DeflateMaxMatch) && (zipCollection[here + length] === zipCollection[matchPos + length])) {
		++length;
	}
	return length;
}


/*	Continue deflating the receiver's collection from blockPosition to lastIndex.
	Note that lastIndex must be at least MaxMatch away from the end of collection */

function deflateBlockchainLengthgoodMatch(lastIndex, chainLength, goodMatch) {
	var flushNeeded;
	var hasMatch;
	var here;
	var hereLength;
	var hereMatch;
	var i;
	var matchResult;
	var newLength;
	var newMatch;

	if (zipBlockPos > lastIndex) {
		return false;
	}
	if (zipLiteralCount >= zipLiteralSize) {
		return true;
	}
	hasMatch = false;
	here = zipBlockPos;
	while (here <= lastIndex) {
		if (!hasMatch) {

			/* Find the first match */

			matchResult = findMatchlastLengthlastMatchchainLengthgoodMatch(here, DeflateMinMatch - 1, here, chainLength, goodMatch);
			insertStringAt(here);
			hereMatch = matchResult & 65535;
			hereLength = matchResult >>> 16;
		}
		matchResult = findMatchlastLengthlastMatchchainLengthgoodMatch(here + 1, hereLength, hereMatch, chainLength, goodMatch);
		newMatch = matchResult & 65535;

		/* Now check if the next match is better than the current one.
		If not, output the current match (provided that the current match
		is at least MinMatch long) */

		newLength = matchResult >>> 16;
		if ((hereLength >= newLength) && (hereLength >= DeflateMinMatch)) {

			/* Encode the current match */


			/* Insert all strings up to the end of the current match.
			Note: The first string has already been inserted. */

			flushNeeded = encodeMatchdistance(hereLength, here - hereMatch);
			for (i = 1; i <= (hereLength - 1); i++) {
				insertStringAt((++here));
			}
			hasMatch = false;
			++here;
		} else {

			/* Either the next match is better than the current one or we didn't
			have a good match after all (e.g., current match length < MinMatch).
			Output a single literal. */

			flushNeeded = encodeLiteral(zipCollection[here]);
			++here;
			if ((here <= lastIndex) && (!flushNeeded)) {

				/* Cache the results for the next round */

				insertStringAt(here);
				hasMatch = true;
				hereMatch = newMatch;
				hereLength = newLength;
			}
		}
		if (flushNeeded) {
			zipBlockPos = here;
			return true;
		}
	}
	zipBlockPos = here;
	return false;
}


/*	Determine the inst size of the class above DeflateStream by
	 looking for the first class whose inst size is less than 13. */

function determineSizeOfReadStream(rcvr) {
	var sq_class;

	sq_class = CLASSOF(rcvr);
	while ((!sq_class.isNil) && (sq_class.classInstSize() >= 13)) {
		sq_class = sq_class.superclass();
	}
	if (sq_class.isNil) {
		return false;
	}
	readStreamInstSize = sq_class.classInstSize();
	return true;
}


/*	Determine the inst size of the class above DeflateStream or
	 ZipEncoder by looking for the first class whose inst size is less than 7. */

function determineSizeOfWriteStream(rcvr) {
	var sq_class;

	sq_class = CLASSOF(rcvr);
	while ((!sq_class.isNil) && (sq_class.classInstSize() >= 7)) {
		sq_class = sq_class.superclass();
	}
	if (sq_class.isNil) {
		return false;
	}
	writeStreamInstSize = sq_class.classInstSize();
	return true;
}


/*	Encode the given literal */

function encodeLiteral(lit) {
	zipLiterals[zipLiteralCount] = lit;
	zipDistances[zipLiteralCount] = 0;
	zipLiteralFreq[lit]++;
	++zipLiteralCount;
	return (zipLiteralCount === zipLiteralSize) || (((zipLiteralCount & 4095) === 0) && (shouldFlush()));
}


/*	Encode the given match of length length starting at dist bytes ahead */

function encodeMatchdistance(length, dist) {
	var distance;
	var literal;

	zipLiterals[zipLiteralCount] = (length - DeflateMinMatch);
	zipDistances[zipLiteralCount] = dist;
	literal = zipMatchLengthCodes[length - DeflateMinMatch];
	zipLiteralFreq[literal]++;
	if (dist < 257) {
		distance = zipDistanceCodes[dist - 1];
	} else {
		distance = zipDistanceCodes[256 + ((dist - 1) >>> 7)];
	}
	zipDistanceFreq[distance]++;
	++zipLiteralCount;
	++zipMatchCount;
	return (zipLiteralCount === zipLiteralSize) || (((zipLiteralCount & 4095) === 0) && (shouldFlush()));
}


/*	Find the longest match for the string starting at here.
	If there is no match longer than lastLength return lastMatch/lastLength.
	Traverse at most maxChainLength entries in the hash table.
	Stop if a match of at least goodMatch size has been found. */

function findMatchlastLengthlastMatchchainLengthgoodMatch(here, lastLength, lastMatch, maxChainLength, goodMatch) {
	var bestLength;
	var chainLength;
	var distance;
	var length;
	var limit;
	var matchPos;
	var matchResult;


	/* Compute the default match result */


	/* There is no way to find a better match than MaxMatch */

	matchResult = (lastLength << 16) | lastMatch;
	if (lastLength >= DeflateMaxMatch) {
		return matchResult;
	}

	/* Compute the distance to the (possible) match */

	matchPos = zipHashHead[updateHashAt((here + DeflateMinMatch) - 1)];

	/* Note: It is required that 0 < distance < MaxDistance */

	distance = here - matchPos;
	if (!((distance > 0) && (distance < DeflateMaxDistance))) {
		return matchResult;
	}

	/* Max. nr of match chain to search */

	chainLength = maxChainLength;
	if (here > DeflateMaxDistance) {

		/* Limit for matches that are too old */

		limit = here - DeflateMaxDistance;
	} else {
		limit = 0;
	}
	bestLength = lastLength;
	while (true) {

		/* Compare the current string with the string at match position */


		/* Truncate accidental matches beyound stream position */

		length = comparewithmin(here, matchPos, bestLength);
		if ((here + length) > zipPosition) {
			length = zipPosition - here;
		}
		if ((length === DeflateMinMatch) && ((here - matchPos) > (DeflateMaxDistance >> 2))) {
			length = DeflateMinMatch - 1;
		}
		if (length > bestLength) {

			/* We have a new (better) match than before */
			/* Compute the new match result */

			matchResult = (length << 16) | matchPos;

			/* There is no way to find a better match than MaxMatch */

			bestLength = length;
			if (bestLength >= DeflateMaxMatch) {
				return matchResult;
			}
			if (bestLength > goodMatch) {
				return matchResult;
			}
		}
		if (!(((--chainLength)) > 0)) {
			return matchResult;
		}
		matchPos = zipHashTail[matchPos & DeflateWindowMask];
		if (matchPos <= limit) {
			return matchResult;
		}
	}
}


/*	Note: This is hardcoded so it can be run from Squeak.
	The module name is used for validating a module *after*
	it is loaded to check if it does really contain the module
	we're thinking it contains. This is important! */

function getModuleName() {
	return moduleName;
}

function halt() {
	;
}


/*	Insert the string at the given start position into the hash table.
	Note: The hash value is updated starting at MinMatch-1 since
	all strings before have already been inserted into the hash table
	(and the hash value is updated as well). */

function insertStringAt(here) {
	var prevEntry;

	zipHashValue = updateHashAt((here + DeflateMinMatch) - 1);
	prevEntry = zipHashHead[zipHashValue];
	zipHashHead[zipHashValue] = here;
	zipHashTail[here & DeflateWindowMask] = prevEntry;
}

function loadDeflateStreamFrom(rcvr) {
	var oop;

	if (!(interpreterProxy.isPointers(rcvr) && (SIZEOF(rcvr) >= 15))) {
		return false;
	}
	oop = interpreterProxy.fetchPointerofObject(0, rcvr);
	if (!interpreterProxy.isBytes(oop)) {
		return false;
	}
	if (writeStreamInstSize === 0) {
		if (!determineSizeOfWriteStream(rcvr)) {
			return false;
		}
		if (SIZEOF(rcvr) < (writeStreamInstSize + 5)) {
			writeStreamInstSize = 0;
			return false;
		}
	}
	zipCollection = oop.bytes;
	zipCollectionSize = BYTESIZEOF(oop);
	zipPosition = interpreterProxy.fetchIntegerofObject(1, rcvr);

	/* zipWriteLimit := interpreterProxy fetchInteger: 3 ofObject: rcvr. */

	zipReadLimit = interpreterProxy.fetchIntegerofObject(2, rcvr);
	oop = interpreterProxy.fetchPointerofObject(writeStreamInstSize + 0, rcvr);
	if (!(interpreterProxy.isWords(oop) && (SIZEOF(oop) === DeflateHashTableSize))) {
		return false;
	}
	zipHashHead = oop.words;
	oop = interpreterProxy.fetchPointerofObject(writeStreamInstSize + 1, rcvr);
	if (!(interpreterProxy.isWords(oop) && (SIZEOF(oop) === DeflateWindowSize))) {
		return false;
	}
	zipHashTail = oop.words;
	zipHashValue = interpreterProxy.fetchIntegerofObject(writeStreamInstSize + 2, rcvr);

	/* zipBlockStart := interpreterProxy fetchInteger: writeStreamInstSize + 4 ofObject: rcvr. */

	zipBlockPos = interpreterProxy.fetchIntegerofObject(writeStreamInstSize + 3, rcvr);
	oop = interpreterProxy.fetchPointerofObject(writeStreamInstSize + 5, rcvr);
	if (!interpreterProxy.isBytes(oop)) {
		return false;
	}
	zipLiteralSize = SIZEOF(oop);
	zipLiterals = oop.bytes;
	oop = interpreterProxy.fetchPointerofObject(writeStreamInstSize + 6, rcvr);
	if (!(interpreterProxy.isWords(oop) && (SIZEOF(oop) >= zipLiteralSize))) {
		return false;
	}
	zipDistances = oop.words;
	oop = interpreterProxy.fetchPointerofObject(writeStreamInstSize + 7, rcvr);
	if (!(interpreterProxy.isWords(oop) && (SIZEOF(oop) === DeflateMaxLiteralCodes))) {
		return false;
	}
	zipLiteralFreq = oop.words;
	oop = interpreterProxy.fetchPointerofObject(writeStreamInstSize + 8, rcvr);
	if (!(interpreterProxy.isWords(oop) && (SIZEOF(oop) === DeflateMaxDistanceCodes))) {
		return false;
	}
	zipDistanceFreq = oop.words;
	zipLiteralCount = interpreterProxy.fetchIntegerofObject(writeStreamInstSize + 9, rcvr);
	zipMatchCount = interpreterProxy.fetchIntegerofObject(writeStreamInstSize + 10, rcvr);
	return !interpreterProxy.failed();
}

function loadZipEncoderFrom(rcvr) {
	var oop;

	if (writeStreamInstSize === 0) {
		if (!determineSizeOfWriteStream(rcvr)) {
			return false;
		}
		if (SIZEOF(rcvr) < (writeStreamInstSize + 3)) {
			writeStreamInstSize = 0;
			return false;
		}
	}
	if (!(interpreterProxy.isPointers(rcvr) && (SIZEOF(rcvr) >= (writeStreamInstSize + 3)))) {
		return false;
	}
	oop = interpreterProxy.fetchPointerofObject(0, rcvr);
	if (!interpreterProxy.isBytes(oop)) {
		return interpreterProxy.primitiveFail();
	}
	zipCollection = oop.bytes;
	zipCollectionSize = BYTESIZEOF(oop);
	zipPosition = interpreterProxy.fetchIntegerofObject(1, rcvr);

	/* zipWriteLimit := interpreterProxy fetchInteger: 3 ofObject: rcvr. */

	zipReadLimit = interpreterProxy.fetchIntegerofObject(2, rcvr);
	zipBitBuf = interpreterProxy.fetchIntegerofObject(writeStreamInstSize + 1, rcvr);
	zipBitPos = interpreterProxy.fetchIntegerofObject(writeStreamInstSize + 2, rcvr);
	return !interpreterProxy.failed();
}


/*	Require:
		zipCollection, zipCollectionSize, zipPosition,
		zipBitBuf, zipBitPos.
	 */

function nextZipBitsput(nBits, value) {
	if (!((value >= 0) && ((SHL(1, nBits)) > value))) {
		return interpreterProxy.primitiveFail();
	}
	zipBitBuf = zipBitBuf | (SHL(value, zipBitPos));
	zipBitPos += nBits;
	while ((zipBitPos >= 8) && (zipPosition < zipCollectionSize)) {
		zipCollection[zipPosition] = (zipBitBuf & 255);
		++zipPosition;
		zipBitBuf = zipBitBuf >>> 8;
		zipBitPos -= 8;
	}
}


/*	Primitive. Deflate the current contents of the receiver. */

function primitiveDeflateBlock() {
	var chainLength;
	var goodMatch;
	var lastIndex;
	var rcvr;
	var result;

	if (interpreterProxy.methodArgumentCount() !== 3) {
		return interpreterProxy.primitiveFail();
	}
	goodMatch = interpreterProxy.stackIntegerValue(0);
	chainLength = interpreterProxy.stackIntegerValue(1);
	lastIndex = interpreterProxy.stackIntegerValue(2);
	rcvr = interpreterProxy.stackObjectValue(3);
	if (interpreterProxy.failed()) {
		return null;
	}
	;
	if (!loadDeflateStreamFrom(rcvr)) {
		return interpreterProxy.primitiveFail();
	}
	result = deflateBlockchainLengthgoodMatch(lastIndex, chainLength, goodMatch);
	if (!interpreterProxy.failed()) {

		/* Store back modified values */

		interpreterProxy.storeIntegerofObjectwithValue(writeStreamInstSize + 2, rcvr, zipHashValue);
		interpreterProxy.storeIntegerofObjectwithValue(writeStreamInstSize + 3, rcvr, zipBlockPos);
		interpreterProxy.storeIntegerofObjectwithValue(writeStreamInstSize + 9, rcvr, zipLiteralCount);
		interpreterProxy.storeIntegerofObjectwithValue(writeStreamInstSize + 10, rcvr, zipMatchCount);
	}
	if (!interpreterProxy.failed()) {
		interpreterProxy.pop(4);
		interpreterProxy.pushBool(result);
	}
}


/*	Primitive. Update the hash tables after data has been moved by delta. */

function primitiveDeflateUpdateHashTable() {
	var delta;
	var entry;
	var i;
	var table;
	var tablePtr;
	var tableSize;

	if (interpreterProxy.methodArgumentCount() !== 2) {
		return interpreterProxy.primitiveFail();
	}
	delta = interpreterProxy.stackIntegerValue(0);
	table = interpreterProxy.stackObjectValue(1);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!interpreterProxy.isWords(table)) {
		return interpreterProxy.primitiveFail();
	}
	tableSize = SIZEOF(table);
	tablePtr = table.wordsAsInt32Array();
	for (i = 0; i <= (tableSize - 1); i++) {
		entry = tablePtr[i];
		if (entry >= delta) {
			tablePtr[i] = (entry - delta);
		} else {
			tablePtr[i] = 0;
		}
	}
	interpreterProxy.pop(2);
}


/*	Primitive. Inflate a single block. */

function primitiveInflateDecompressBlock() {
	var oop;
	var rcvr;

	if (interpreterProxy.methodArgumentCount() !== 2) {
		return interpreterProxy.primitiveFail();
	}
	oop = interpreterProxy.stackValue(0);
	if (!interpreterProxy.isWords(oop)) {
		return interpreterProxy.primitiveFail();
	}
	zipDistTable = oop.words;

	/* literal table */

	zipDistTableSize = SIZEOF(oop);
	oop = interpreterProxy.stackValue(1);
	if (!interpreterProxy.isWords(oop)) {
		return interpreterProxy.primitiveFail();
	}
	zipLitTable = oop.words;

	/* Receiver (InflateStream) */

	zipLitTableSize = SIZEOF(oop);
	rcvr = interpreterProxy.stackValue(2);
	if (!interpreterProxy.isPointers(rcvr)) {
		return interpreterProxy.primitiveFail();
	}
	if (readStreamInstSize === 0) {
		if (!determineSizeOfReadStream(rcvr)) {
			return interpreterProxy.primitiveFail();
		}
		if (SIZEOF(rcvr) < (readStreamInstSize + 8)) {
			readStreamInstSize = 0;
			return interpreterProxy.primitiveFail();
		}
	}
	if (SIZEOF(rcvr) < (readStreamInstSize + 8)) {
		return interpreterProxy.primitiveFail();
	}
	zipReadLimit = interpreterProxy.fetchIntegerofObject(2, rcvr);
	zipState = interpreterProxy.fetchIntegerofObject(readStreamInstSize + 0, rcvr);
	zipBitBuf = interpreterProxy.fetchIntegerofObject(readStreamInstSize + 1, rcvr);
	zipBitPos = interpreterProxy.fetchIntegerofObject(readStreamInstSize + 2, rcvr);
	zipSourcePos = interpreterProxy.fetchIntegerofObject(readStreamInstSize + 4, rcvr);
	zipSourceLimit = interpreterProxy.fetchIntegerofObject(readStreamInstSize + 5, rcvr);
	if (interpreterProxy.failed()) {
		return null;
	}
	--zipReadLimit;
	--zipSourcePos;

	/* collection */

	--zipSourceLimit;
	oop = interpreterProxy.fetchPointerofObject(0, rcvr);
	if (!interpreterProxy.isBytes(oop)) {
		return interpreterProxy.primitiveFail();
	}
	zipCollection = oop.bytes;

	/* source */

	zipCollectionSize = BYTESIZEOF(oop);
	oop = interpreterProxy.fetchPointerofObject(readStreamInstSize + 3, rcvr);
	if (!interpreterProxy.isBytes(oop)) {
		return interpreterProxy.primitiveFail();
	}

	/* do the primitive */

	zipSource = oop.bytes;
	zipDecompressBlock();
	if (!interpreterProxy.failed()) {

		/* store modified values back */

		interpreterProxy.storeIntegerofObjectwithValue(2, rcvr, zipReadLimit + 1);
		interpreterProxy.storeIntegerofObjectwithValue(readStreamInstSize + 0, rcvr, zipState);
		interpreterProxy.storeIntegerofObjectwithValue(readStreamInstSize + 1, rcvr, zipBitBuf);
		interpreterProxy.storeIntegerofObjectwithValue(readStreamInstSize + 2, rcvr, zipBitPos);
		interpreterProxy.storeIntegerofObjectwithValue(readStreamInstSize + 4, rcvr, zipSourcePos + 1);
		interpreterProxy.pop(2);
	}
}


/*	Primitive. Update a 32bit CRC value. */

function primitiveUpdateAdler32() {
	var adler32;
	var b;
	var bytePtr;
	var collection;
	var i;
	var length;
	var s1;
	var s2;
	var startIndex;
	var stopIndex;

	if (interpreterProxy.methodArgumentCount() !== 4) {
		return interpreterProxy.primitiveFail();
	}
	collection = interpreterProxy.stackObjectValue(0);
	stopIndex = interpreterProxy.stackIntegerValue(1);
	startIndex = interpreterProxy.stackIntegerValue(2);
	adler32 = interpreterProxy.positive32BitValueOf(interpreterProxy.stackValue(3));
	if (interpreterProxy.failed()) {
		return 0;
	}
	if (!(interpreterProxy.isBytes(collection) && ((stopIndex >= startIndex) && (startIndex > 0)))) {
		return interpreterProxy.primitiveFail();
	}
	length = BYTESIZEOF(collection);
	if (!(stopIndex <= length)) {
		return interpreterProxy.primitiveFail();
	}
	bytePtr = collection.bytes;
	--startIndex;
	--stopIndex;
	s1 = adler32 & 65535;
	s2 = (adler32 >>> 16) & 65535;
	for (i = startIndex; i <= stopIndex; i++) {
		b = bytePtr[i];
		s1 = MOD((s1 + b), 65521);
		s2 = MOD((s2 + s1), 65521);
	}
	adler32 = (s2 << 16) + s1;
	interpreterProxy.popthenPush(5, interpreterProxy.positive32BitIntegerFor(adler32));
}


/*	Primitive. Update a 32bit CRC value. */

function primitiveUpdateGZipCrc32() {
	var bytePtr;
	var collection;
	var crc;
	var i;
	var length;
	var startIndex;
	var stopIndex;

	if (interpreterProxy.methodArgumentCount() !== 4) {
		return interpreterProxy.primitiveFail();
	}
	collection = interpreterProxy.stackObjectValue(0);
	stopIndex = interpreterProxy.stackIntegerValue(1);
	startIndex = interpreterProxy.stackIntegerValue(2);
	crc = interpreterProxy.positive32BitValueOf(interpreterProxy.stackValue(3));
	if (interpreterProxy.failed()) {
		return 0;
	}
	if (!(interpreterProxy.isBytes(collection) && ((stopIndex >= startIndex) && (startIndex > 0)))) {
		return interpreterProxy.primitiveFail();
	}
	length = BYTESIZEOF(collection);
	if (!(stopIndex <= length)) {
		return interpreterProxy.primitiveFail();
	}
	bytePtr = collection.bytes;
	;
	--startIndex;
	--stopIndex;
	for (i = startIndex; i <= stopIndex; i++) {
		crc = zipCrcTable[(crc ^ bytePtr[i]) & 255] ^ (crc >>> 8);
	}
	interpreterProxy.popthenPush(5, interpreterProxy.positive32BitIntegerFor(crc));
}

function primitiveZipSendBlock() {
	var distStream;
	var distTree;
	var litStream;
	var litTree;
	var rcvr;
	var result;

	if (interpreterProxy.methodArgumentCount() !== 4) {
		return interpreterProxy.primitiveFail();
	}
	distTree = interpreterProxy.stackObjectValue(0);
	litTree = interpreterProxy.stackObjectValue(1);
	distStream = interpreterProxy.stackObjectValue(2);
	litStream = interpreterProxy.stackObjectValue(3);
	rcvr = interpreterProxy.stackObjectValue(4);
	if (interpreterProxy.failed()) {
		return null;
	}
	if (!loadZipEncoderFrom(rcvr)) {
		return interpreterProxy.primitiveFail();
	}
	if (!(interpreterProxy.isPointers(distTree) && (SIZEOF(distTree) >= 2))) {
		return interpreterProxy.primitiveFail();
	}
	if (!(interpreterProxy.isPointers(litTree) && (SIZEOF(litTree) >= 2))) {
		return interpreterProxy.primitiveFail();
	}
	if (!(interpreterProxy.isPointers(litStream) && (SIZEOF(litStream) >= 3))) {
		return interpreterProxy.primitiveFail();
	}
	if (!(interpreterProxy.isPointers(distStream) && (SIZEOF(distStream) >= 3))) {
		return interpreterProxy.primitiveFail();
	}
	;
	result = sendBlockwithwithwith(litStream, distStream, litTree, distTree);
	if (!interpreterProxy.failed()) {
		interpreterProxy.storeIntegerofObjectwithValue(1, rcvr, zipPosition);
		interpreterProxy.storeIntegerofObjectwithValue(readStreamInstSize + 1, rcvr, zipBitBuf);
		interpreterProxy.storeIntegerofObjectwithValue(readStreamInstSize + 2, rcvr, zipBitPos);
	}
	if (!interpreterProxy.failed()) {
		interpreterProxy.pop(5);
		interpreterProxy.pushInteger(result);
	}
}


/*	Require: 
		zipCollection, zipCollectionSize, zipPosition,
		zipBitBuf, zipBitPos.
	 */

function sendBlockwithwithwith(literalStream, distanceStream, litTree, distTree) {
	var code;
	var dist;
	var distArray;
	var distBitLengths;
	var distBlCount;
	var distCodes;
	var extra;
	var lit;
	var litArray;
	var litBlCount;
	var litLimit;
	var litPos;
	var llBitLengths;
	var llCodes;
	var oop;
	var sum;

	oop = interpreterProxy.fetchPointerofObject(0, literalStream);
	litPos = interpreterProxy.fetchIntegerofObject(1, literalStream);
	litLimit = interpreterProxy.fetchIntegerofObject(2, literalStream);
	if (!((litPos <= litLimit) && (interpreterProxy.isBytes(oop) && (litLimit <= BYTESIZEOF(oop))))) {
		return interpreterProxy.primitiveFail();
	}
	litArray = oop.bytes;
	oop = interpreterProxy.fetchPointerofObject(0, distanceStream);
	if (!(interpreterProxy.isWords(oop) && ((litLimit <= SIZEOF(oop)) && ((interpreterProxy.fetchIntegerofObject(1, distanceStream) === litPos) && (interpreterProxy.fetchIntegerofObject(2, distanceStream) === litLimit))))) {
		return interpreterProxy.primitiveFail();
	}
	distArray = oop.words;
	oop = interpreterProxy.fetchPointerofObject(0, litTree);
	if (!interpreterProxy.isWords(oop)) {
		return interpreterProxy.primitiveFail();
	}
	litBlCount = SIZEOF(oop);
	llBitLengths = oop.words;
	oop = interpreterProxy.fetchPointerofObject(1, litTree);
	if (!(interpreterProxy.isWords(oop) && (litBlCount === SIZEOF(oop)))) {
		return interpreterProxy.primitiveFail();
	}
	llCodes = oop.words;
	oop = interpreterProxy.fetchPointerofObject(0, distTree);
	if (!interpreterProxy.isWords(oop)) {
		return interpreterProxy.primitiveFail();
	}
	distBlCount = SIZEOF(oop);
	distBitLengths = oop.words;
	oop = interpreterProxy.fetchPointerofObject(1, distTree);
	if (!(interpreterProxy.isWords(oop) && (distBlCount === SIZEOF(oop)))) {
		return interpreterProxy.primitiveFail();
	}
	distCodes = oop.words;
	nextZipBitsput(0, 0);
	sum = 0;
	while ((litPos < litLimit) && ((zipPosition + 4) < zipCollectionSize)) {
		lit = litArray[litPos];
		dist = distArray[litPos];
		++litPos;
		if (dist === 0) {

			/* literal */

			++sum;
			if (!(lit < litBlCount)) {
				return interpreterProxy.primitiveFail();
			}
			nextZipBitsput(llBitLengths[lit], llCodes[lit]);
		} else {

			/* match */

			sum = (sum + lit) + DeflateMinMatch;
			if (!(lit < 256)) {
				return interpreterProxy.primitiveFail();
			}
			code = zipMatchLengthCodes[lit];
			if (!(code < litBlCount)) {
				return interpreterProxy.primitiveFail();
			}
			nextZipBitsput(llBitLengths[code], llCodes[code]);
			extra = zipExtraLengthBits[code - 257];
			if (extra !== 0) {
				lit -= zipBaseLength[code - 257];
				nextZipBitsput(extra, lit);
			}
			--dist;
			if (!(dist < 32768)) {
				return interpreterProxy.primitiveFail();
			}
			if (dist < 256) {
				code = zipDistanceCodes[dist];
			} else {
				code = zipDistanceCodes[256 + (dist >>> 7)];
			}
			if (!(code < distBlCount)) {
				return interpreterProxy.primitiveFail();
			}
			nextZipBitsput(distBitLengths[code], distCodes[code]);
			extra = zipExtraDistanceBits[code];
			if (extra !== 0) {
				dist -= zipBaseDistance[code];
				nextZipBitsput(extra, dist);
			}
		}
	}
	if (interpreterProxy.failed()) {
		return null;
	}
	interpreterProxy.storeIntegerofObjectwithValue(1, literalStream, litPos);
	interpreterProxy.storeIntegerofObjectwithValue(1, distanceStream, litPos);
	return sum;
}


/*	Note: This is coded so that is can be run from Squeak. */

function setInterpreter(anInterpreter) {
	var ok;

	interpreterProxy = anInterpreter;
	ok = interpreterProxy.majorVersion() == VM_PROXY_MAJOR;
	if (ok === false) {
		return false;
	}
	ok = interpreterProxy.minorVersion() >= VM_PROXY_MINOR;
	return ok;
}


/*	Check if we should flush the current block.
	Flushing can be useful if the input characteristics change. */

function shouldFlush() {
	var nLits;

	if (zipLiteralCount === zipLiteralSize) {
		return true;
	}
	if ((zipLiteralCount & 4095) !== 0) {
		return false;
	}
	if ((zipMatchCount * 10) <= zipLiteralCount) {

		/* This is basically random data. 
		There is no need to flush early since the overhead
		for encoding the trees will add to the overall size */

		return false;
	}
	nLits = zipLiteralCount - zipMatchCount;
	if (nLits <= zipMatchCount) {
		return false;
	}
	return (nLits * 4) <= zipMatchCount;
}


/*	Update the running hash value based on the next input byte.
	Return the new updated hash value. */

function updateHash(nextValue) {
	return ((zipHashValue << 5) ^ nextValue) & DeflateHashMask;
}


/*	Update the hash value at position here (one based) */

function updateHashAt(here) {
	return updateHash(zipCollection[here]);
}


/*	Decode the next value in the receiver using the given huffman table. */

function zipDecodeValueFromsize(table, tableSize) {
	var bits;
	var bitsNeeded;
	var index;
	var tableIndex;
	var value;


	/* Initial bits needed */

	bitsNeeded = table[0] >>> 24;
	if (bitsNeeded > MaxBits) {
		interpreterProxy.primitiveFail();
		return 0;
	}

	/* First real table */

	tableIndex = 2;
	while (true) {

		/* Get bits */

		bits = zipNextBits(bitsNeeded);
		index = (tableIndex + bits) - 1;
		if (index >= tableSize) {
			interpreterProxy.primitiveFail();
			return 0;
		}

		/* Lookup entry in table */

		value = table[index];
		if ((value & 1056964608) === 0) {
			return value;
		}

		/* Table offset in low 16 bit */

		tableIndex = value & 65535;

		/* Additional bits in high 8 bit */

		bitsNeeded = (value >>> 24) & 255;
		if (bitsNeeded > MaxBits) {
			interpreterProxy.primitiveFail();
			return 0;
		}
	}
	return 0;
}

function zipDecompressBlock() {
	var distance;
	var dstPos;
	var extra;
	var i;
	var length;
	var max;
	var oldBitPos;
	var oldBits;
	var oldPos;
	var srcPos;
	var value;

	max = zipCollectionSize - 1;
	while ((zipReadLimit < max) && (zipSourcePos <= zipSourceLimit)) {

		/* Back up stuff if we're running out of space */

		oldBits = zipBitBuf;
		oldBitPos = zipBitPos;
		oldPos = zipSourcePos;
		value = zipDecodeValueFromsize(zipLitTable, zipLitTableSize);
		if (value < 256) {

			/* A literal */

			zipCollection[(++zipReadLimit)] = value;
		} else {

			/* length/distance or end of block */

			if (value === 256) {

				/* End of block */

				zipState = zipState & StateNoMoreData;
				return 0;
			}
			extra = (value >>> 16) - 1;
			length = value & 65535;
			if (extra > 0) {
				length += zipNextBits(extra);
			}
			value = zipDecodeValueFromsize(zipDistTable, zipDistTableSize);
			extra = value >>> 16;
			distance = value & 65535;
			if (extra > 0) {
				distance += zipNextBits(extra);
			}
			if ((zipReadLimit + length) >= max) {
				zipBitBuf = oldBits;
				zipBitPos = oldBitPos;
				zipSourcePos = oldPos;
				return 0;
			}
			dstPos = zipReadLimit;
			srcPos = zipReadLimit - distance;
			for (i = 1; i <= length; i++) {
				zipCollection[dstPos + i] = zipCollection[srcPos + i];
			}
			zipReadLimit += length;
		}
	}
}

function zipNextBits(n) {
	var bits;
	var byte;

	while (zipBitPos < n) {
		byte = zipSource[(++zipSourcePos)];
		zipBitBuf += SHL(byte, zipBitPos);
		zipBitPos += 8;
	}
	bits = zipBitBuf & ((SHL(1, n)) - 1);
	zipBitBuf = SHR(zipBitBuf, n);
	zipBitPos -= n;
	return bits;
}


Squeak.registerExternalModule("ZipPlugin", {
	primitiveZipSendBlock: primitiveZipSendBlock,
	primitiveUpdateAdler32: primitiveUpdateAdler32,
	primitiveUpdateGZipCrc32: primitiveUpdateGZipCrc32,
	primitiveDeflateUpdateHashTable: primitiveDeflateUpdateHashTable,
	setInterpreter: setInterpreter,
	getModuleName: getModuleName,
	primitiveDeflateBlock: primitiveDeflateBlock,
	primitiveInflateDecompressBlock: primitiveInflateDecompressBlock,
});

}); // end of module

/***** including ../lib/lz-string.js *****/

// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.3.3
var LZString = {
  
  
  // private property
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  _f : String.fromCharCode,
  
  compressToBase64 : function (input) {
    if (input == null) return "";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
    
    input = LZString.compress(input);
    
    while (i < input.length*2) {
      
      if (i%2==0) {
        chr1 = input.charCodeAt(i/2) >> 8;
        chr2 = input.charCodeAt(i/2) & 255;
        if (i/2+1 < input.length) 
          chr3 = input.charCodeAt(i/2+1) >> 8;
        else 
          chr3 = NaN;
      } else {
        chr1 = input.charCodeAt((i-1)/2) & 255;
        if ((i+1)/2 < input.length) {
          chr2 = input.charCodeAt((i+1)/2) >> 8;
          chr3 = input.charCodeAt((i+1)/2) & 255;
        } else 
          chr2=chr3=NaN;
      }
      i+=3;
      
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
      
      output = output +
        LZString._keyStr.charAt(enc1) + LZString._keyStr.charAt(enc2) +
          LZString._keyStr.charAt(enc3) + LZString._keyStr.charAt(enc4);
      
    }
    
    return output;
  },
  
  decompressFromBase64 : function (input) {
    if (input == null) return "";
    var output = "",
        ol = 0, 
        output_,
        chr1, chr2, chr3,
        enc1, enc2, enc3, enc4,
        i = 0, f=LZString._f;
    
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    
    while (i < input.length) {
      
      enc1 = LZString._keyStr.indexOf(input.charAt(i++));
      enc2 = LZString._keyStr.indexOf(input.charAt(i++));
      enc3 = LZString._keyStr.indexOf(input.charAt(i++));
      enc4 = LZString._keyStr.indexOf(input.charAt(i++));
      
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
      
      if (ol%2==0) {
        output_ = chr1 << 8;
        
        if (enc3 != 64) {
          output += f(output_ | chr2);
        }
        if (enc4 != 64) {
          output_ = chr3 << 8;
        }
      } else {
        output = output + f(output_ | chr1);
        
        if (enc3 != 64) {
          output_ = chr2 << 8;
        }
        if (enc4 != 64) {
          output += f(output_ | chr3);
        }
      }
      ol+=3;
    }
    
    return LZString.decompress(output);
    
  },

  compressToUTF16 : function (input) {
    if (input == null) return "";
    var output = "",
        i,c,
        current,
        status = 0,
        f = LZString._f;
    
    input = LZString.compress(input);
    
    for (i=0 ; i<input.length ; i++) {
      c = input.charCodeAt(i);
      switch (status++) {
        case 0:
          output += f((c >> 1)+32);
          current = (c & 1) << 14;
          break;
        case 1:
          output += f((current + (c >> 2))+32);
          current = (c & 3) << 13;
          break;
        case 2:
          output += f((current + (c >> 3))+32);
          current = (c & 7) << 12;
          break;
        case 3:
          output += f((current + (c >> 4))+32);
          current = (c & 15) << 11;
          break;
        case 4:
          output += f((current + (c >> 5))+32);
          current = (c & 31) << 10;
          break;
        case 5:
          output += f((current + (c >> 6))+32);
          current = (c & 63) << 9;
          break;
        case 6:
          output += f((current + (c >> 7))+32);
          current = (c & 127) << 8;
          break;
        case 7:
          output += f((current + (c >> 8))+32);
          current = (c & 255) << 7;
          break;
        case 8:
          output += f((current + (c >> 9))+32);
          current = (c & 511) << 6;
          break;
        case 9:
          output += f((current + (c >> 10))+32);
          current = (c & 1023) << 5;
          break;
        case 10:
          output += f((current + (c >> 11))+32);
          current = (c & 2047) << 4;
          break;
        case 11:
          output += f((current + (c >> 12))+32);
          current = (c & 4095) << 3;
          break;
        case 12:
          output += f((current + (c >> 13))+32);
          current = (c & 8191) << 2;
          break;
        case 13:
          output += f((current + (c >> 14))+32);
          current = (c & 16383) << 1;
          break;
        case 14:
          output += f((current + (c >> 15))+32, (c & 32767)+32);
          status = 0;
          break;
      }
    }
    
    return output + f(current + 32);
  },
  

  decompressFromUTF16 : function (input) {
    if (input == null) return "";
    var output = "",
        current,c,
        status=0,
        i = 0,
        f = LZString._f;
    
    while (i < input.length) {
      c = input.charCodeAt(i) - 32;
      
      switch (status++) {
        case 0:
          current = c << 1;
          break;
        case 1:
          output += f(current | (c >> 14));
          current = (c&16383) << 2;
          break;
        case 2:
          output += f(current | (c >> 13));
          current = (c&8191) << 3;
          break;
        case 3:
          output += f(current | (c >> 12));
          current = (c&4095) << 4;
          break;
        case 4:
          output += f(current | (c >> 11));
          current = (c&2047) << 5;
          break;
        case 5:
          output += f(current | (c >> 10));
          current = (c&1023) << 6;
          break;
        case 6:
          output += f(current | (c >> 9));
          current = (c&511) << 7;
          break;
        case 7:
          output += f(current | (c >> 8));
          current = (c&255) << 8;
          break;
        case 8:
          output += f(current | (c >> 7));
          current = (c&127) << 9;
          break;
        case 9:
          output += f(current | (c >> 6));
          current = (c&63) << 10;
          break;
        case 10:
          output += f(current | (c >> 5));
          current = (c&31) << 11;
          break;
        case 11:
          output += f(current | (c >> 4));
          current = (c&15) << 12;
          break;
        case 12:
          output += f(current | (c >> 3));
          current = (c&7) << 13;
          break;
        case 13:
          output += f(current | (c >> 2));
          current = (c&3) << 14;
          break;
        case 14:
          output += f(current | (c >> 1));
          current = (c&1) << 15;
          break;
        case 15:
          output += f(current | c);
          status=0;
          break;
      }
      
      
      i++;
    }
    
    return LZString.decompress(output);
    //return output;
    
  },


  
  compress: function (uncompressed) {
    if (uncompressed == null) return "";
    var i, value,
        context_dictionary= {},
        context_dictionaryToCreate= {},
        context_c="",
        context_wc="",
        context_w="",
        context_enlargeIn= 2, // Compensate for the first entry which should not count
        context_dictSize= 3,
        context_numBits= 2,
        context_data_string="", 
        context_data_val=0, 
        context_data_position=0,
        ii,
        f=LZString._f;
    
    for (ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      
      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
          if (context_w.charCodeAt(0)<256) {
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<8 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<16 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == 15) {
                context_data_position = 0;
                context_data_string += f(context_data_val);
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
          
          
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        // Add wc to the dictionary.
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }
    
    // Output the code for w.
    if (context_w !== "") {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
        if (context_w.charCodeAt(0)<256) {
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<8 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<16 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data_string += f(context_data_val);
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i=0 ; i<context_numBits ; i++) {
          context_data_val = (context_data_val << 1) | (value&1);
          if (context_data_position == 15) {
            context_data_position = 0;
            context_data_string += f(context_data_val);
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
        
        
      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }
    
    // Mark the end of the stream
    value = 2;
    for (i=0 ; i<context_numBits ; i++) {
      context_data_val = (context_data_val << 1) | (value&1);
      if (context_data_position == 15) {
        context_data_position = 0;
        context_data_string += f(context_data_val);
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }
    
    // Flush the last char
    while (true) {
      context_data_val = (context_data_val << 1);
      if (context_data_position == 15) {
        context_data_string += f(context_data_val);
        break;
      }
      else context_data_position++;
    }
    return context_data_string;
  },
  
  decompress: function (compressed) {
    if (compressed == null) return "";
    if (compressed == "") return null;
    var dictionary = [],
        next,
        enlargeIn = 4,
        dictSize = 4,
        numBits = 3,
        entry = "",
        result = "",
        i,
        w,
        bits, resb, maxpower, power,
        c,
        f = LZString._f,
        data = {string:compressed, val:compressed.charCodeAt(0), position:32768, index:1};
    
    for (i = 0; i < 3; i += 1) {
      dictionary[i] = i;
    }
    
    bits = 0;
    maxpower = Math.pow(2,2);
    power=1;
    while (power!=maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = 32768;
        data.val = data.string.charCodeAt(data.index++);
      }
      bits |= (resb>0 ? 1 : 0) * power;
      power <<= 1;
    }
    
    switch (next = bits) {
      case 0: 
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 1: 
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 2: 
        return "";
    }
    dictionary[3] = c;
    w = result = c;
    while (true) {
      if (data.index > data.string.length) {
        return "";
      }
      
      bits = 0;
      maxpower = Math.pow(2,numBits);
      power=1;
      while (power!=maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = 32768;
          data.val = data.string.charCodeAt(data.index++);
        }
        bits |= (resb>0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch (c = bits) {
        case 0: 
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 1: 
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = 32768;
              data.val = data.string.charCodeAt(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 2: 
          return result;
      }
      
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      
      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result += entry;
      
      // Add w+entry[0] to the dictionary.
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;
      
      w = entry;
      
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      
    }
  }
};

if( typeof module !== 'undefined' && module != null ) {
  module.exports = LZString
}
