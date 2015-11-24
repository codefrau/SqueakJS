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

"use strict";    

//////////////////////////////////////////////////////////////////////////////
// these functions fake the Lively module and class system
// just enough so the loading of vm.js succeeds
//////////////////////////////////////////////////////////////////////////////

window.module = function(dottedPath) {
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
                    function load() {
                        code();
                        self.loaded = true;
                        self.pending.forEach(function(f){f()});
                    }
                    if (req && !module(req).loaded) {
                        module(req).pending.push(load);
                    } else {
                        load();
                    }
                }
            }
        },
    };
    return self;
};

Object.extend = function(obj /* + more args */ ) {
    // skip arg 0, copy properties of other args to obj
    for (var i = 1; i < arguments.length; i++)
        if (typeof arguments[i] == 'object')
            for (name in arguments[i])
                obj[name] = arguments[i][name];
};

Function.prototype.subclass = function(classPath /* + more args */ ) {
    // create subclass
    var subclass = function() {
        if (this.initialize) this.initialize.apply(this, arguments);
        return this;
    };
    // set up prototype
    var protoclass = function() { };
    protoclass.prototype = this.prototype;
    subclass.prototype = new protoclass();
    // skip arg 0, copy properties of other args to prototype
    for (var i = 1; i < arguments.length; i++)
        Object.extend(subclass.prototype, arguments[i]);
    // add class to module
    var modulePath = classPath.split("."),
        className = modulePath.pop();
    module(modulePath.join('.'))[className] = subclass;
    return subclass;
};

//////////////////////////////////////////////////////////////////////////////
// load vm, plugins, and other libraries
//////////////////////////////////////////////////////////////////////////////

(function(){
    var scripts = document.getElementsByTagName("script"),
        squeakjs = scripts[scripts.length - 1],
        vmDir = squeakjs.src.replace(/[^\/]*$/, "");
    if (squeakjs.src.match(/squeak\.min\.js$/)) return;
    [   "vm.js",
        "jit.js",
        "plugins/ADPCMCodecPlugin.js",
        "plugins/B2DPlugin.js",
        "plugins/BitBltPlugin.js",
        "plugins/FFTPlugin.js",
        "plugins/FloatArrayPlugin.js",
        "plugins/GeniePlugin.js",
        "plugins/JPEGReaderPlugin.js",
        "plugins/KedamaPlugin.js",
        "plugins/KedamaPlugin2.js",
        "plugins/Klatt.js",
        "plugins/LargeIntegers.js",
        "plugins/Matrix2x3Plugin.js",
        "plugins/MiscPrimitivePlugin.js",
        "plugins/ScratchPlugin.js",
        "plugins/SoundGenerationPlugin.js",
        "plugins/StarSqueakPlugin.js",
        "plugins/ZipPlugin.js",
        "lib/lz-string.js",
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
    var box = canvas.parentElement,
        fullscreenEvent = "fullscreenchange",
        fullscreenElement = "fullscreenElement",
        fullscreenEnabled = "fullscreenEnabled";

    if (!box.requestFullscreen) {
        [    // Fullscreen support is still very browser-dependent
            {req: box.webkitRequestFullscreen, exit: document.webkitExitFullscreen,
                evt: "webkitfullscreenchange", elem: "webkitFullscreenElement", enable: "webkitFullscreenEnabled"},
            {req: box.mozRequestFullScreen, exit: document.mozCancelFullScreen,
                evt: "mozfullscreenchange", elem: "mozFullScreenElement", enable: "mozFullScreenEnabled"},
            {req: box.msRequestFullscreen, exit: document.msExitFullscreen,
                evt: "MSFullscreenChange", elem: "msFullscreenElement", enable: "msFullscreenEnabled"},
        ].forEach(function(browser) {
            if (browser.req) {
                box.requestFullscreen = browser.req;
                document.exitFullscreen = browser.exit;
                fullscreenEvent = browser.evt;
                fullscreenElement = browser.elem;
                fullscreenEnabled = browser.enable;
            }
        })
    }

    // If the user canceled fullscreen, turn off the fullscreen flag so
    // we don't try to enable it again in the next event
    function fullscreenChange(fullscreen) {
        display.fullscreen = fullscreen;
        box.style.background = fullscreen ? 'black' : '';
        if (options.header) options.header.style.display = fullscreen ? 'none' : '';
        if (options.footer) options.footer.style.display = fullscreen ? 'none' : '';
        if (options.fullscreenCheckbox) options.fullscreenCheckbox.checked = fullscreen;
        setTimeout(window.onresize, 0);
    };
    
    var checkFullscreen;
    
    if (box.requestFullscreen) {
        document.addEventListener(fullscreenEvent, function(){fullscreenChange(box == document[fullscreenElement])});
        checkFullscreen = function() {
            if (document[fullscreenEnabled] && (box == document[fullscreenElement]) != display.fullscreen) {
                if (display.fullscreen) box.requestFullscreen();
                else document.exitFullscreen();
            }
        }
    } else {
        var isFullscreen = false;
        checkFullscreen = function() {
            if ((options.header || options.footer) && isFullscreen != display.fullscreen) {
                isFullscreen = display.fullscreen;
                fullscreenChange(isFullscreen);
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

function recordModifiers(evt, display) {
    var modifiers =
        (evt.shiftKey ? Squeak.Keyboard_Shift : 0) +
        (evt.ctrlKey ? Squeak.Keyboard_Ctrl : 0) +
        (evt.altKey || evt.metaKey ? Squeak.Keyboard_Cmd : 0);
    display.buttons = (display.buttons & ~Squeak.Keyboard_All) | modifiers;
    return modifiers;
}

function updateMousePos(evt, canvas, display) {
    display.cursorCanvas.style.left = (evt.pageX + display.cursorOffsetX) + "px";
    display.cursorCanvas.style.top = (evt.pageY + display.cursorOffsetY) + "px";
    var x = ((evt.pageX - canvas.offsetLeft) * (canvas.width / canvas.offsetWidth)) | 0,
        y = ((evt.pageY - canvas.offsetTop) * (canvas.height / canvas.offsetHeight)) | 0;
    // clamp to display size
    display.mouseX = Math.max(0, Math.min(display.width, x));
    display.mouseY = Math.max(0, Math.min(display.height, y));
}

function recordMouseEvent(what, evt, canvas, display, eventQueue, options) {
    if (what != "touchend") {
        updateMousePos(evt, canvas, display);
    }
    if (!display.vm) return;
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
    if (!display.vm) return;
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
            key,  // Unicode
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

function recordDragDropEvent(type, evt, canvas, display, eventQueue) {
    if (!display.vm || !eventQueue) return;
    updateMousePos(evt, canvas, display);
    eventQueue.push([
        Squeak.EventTypeDragDropFiles,
        evt.timeStamp,  // converted to Squeak time in makeSqueakEvent()
        type,
        display.mouseX,
        display.mouseY,
        display.buttons >> 3,
        display.droppedFiles.length,
    ]);
    if (display.signalInputEvent)
        display.signalInputEvent();
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
        width: 0,   // if 0, VM uses canvas.width
        height: 0,  // if 0, VM uses canvas.height
        scale: 1,   // changed dynamically by VM if fixedWidth is set
        mouseX: 0,
        mouseY: 0,
        buttons: 0,
        keys: [],
        clipboardString: '',
        clipboardStringChanged: false,
        cursorCanvas: document.createElement("canvas"),
        cursorOffsetX: 0,
        cursorOffsetY: 0,
        droppedFiles: [],
        signalInputEvent: null, // function set by VM
        // additional functions added below
    };
    setupSwapButtons(options);
    if (options.pixelated) {
        canvas.classList.add("pixelated");
        display.cursorCanvas.classList.add("pixelated");
    }

    var eventQueue = null;
    display.reset = function() {
        eventQueue = null;
        display.signalInputEvent = null;
        display.lastTick = 0;
        display.getNextEvent = function(firstEvtBuf, firstOffset) {
            // might be called from VM to get queued event
            eventQueue = []; // create queue on first call
            eventQueue.push = function(evt) {
                eventQueue.offset = Date.now() - evt[1]; // get epoch from first event
                delete eventQueue.push;                  // use original push from now on
                eventQueue.push(evt);
            }
            display.getNextEvent = function(evtBuf, timeOffset) {
                var evt = eventQueue.shift();
                if (evt) makeSqueakEvent(evt, evtBuf, timeOffset - eventQueue.offset);
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
    // cursorCanvas shows Squeak cursor
    display.cursorCanvas.style.display = "block";
    display.cursorCanvas.style.position = "absolute";
    display.cursorCanvas.style.cursor = "none";
    display.cursorCanvas.style.background = "transparent";
    ['onmousedown', 'onmouseup', 'onmousemove', 'oncontextmenu',
    'ontouchstart', 'ontouchmove', 'ontouchend', 'ontouchcancel'].
        forEach(function(handler) { display.cursorCanvas[handler] = canvas[handler]; });
    canvas.parentElement.appendChild(display.cursorCanvas);
    canvas.style.cursor = "none";
    // keyboard stuff
    document.onkeypress = function(evt) {
        if (!display.vm) return true;
        // check for ctrl-x/c/v/r
        if (/[CXVR]/.test(String.fromCharCode(evt.charCode + 64)))
            return true;  // let browser handle cut/copy/paste/reload
        recordModifiers(evt, display);
        recordKeyboardEvent(evt.charCode, evt.timeStamp, display, eventQueue);
        evt.preventDefault();
    };
    document.onkeydown = function(evt) {
        checkFullscreen();
        if (!display.vm) return true;
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
        if (!display.vm) return true;
        recordModifiers(evt, display);
    };
    document.oncopy = function(evt, key) {
        if (!display.vm) return true;
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
        if (!display.vm) return true;
        document.oncopy(evt, 'x');
    };
    document.onpaste = function(evt) {
        if (!display.vm) return true;
        try {
            display.clipboardString = evt.clipboardData.getData('Text');
            // simulate paste event for Squeak
            fakeCmdOrCtrlKey('v'.charCodeAt(0), evt.timeStamp, display, eventQueue);
        } catch(err) {
            alert("paste error " + err);
        }
        evt.preventDefault();
    };
    // do not use addEventListener, we want to replace any previous drop handler
    function dragEventHasFiles(evt) {
        for (var i = 0; i < evt.dataTransfer.types.length; i++)
            if (evt.dataTransfer.types[i] == 'Files') return true;
        return false;
    }
    document.body.ondragover = function(evt) {
        evt.preventDefault();
        if (!dragEventHasFiles(evt))
            return evt.dataTransfer.dropEffect = 'none';
        evt.dataTransfer.dropEffect = 'copy';
        recordDragDropEvent(Squeak.EventDragMove, evt, canvas, display, eventQueue);
        return false;
    };
    document.body.ondragenter = function(evt) {
        if (!dragEventHasFiles(evt)) return;
        recordDragDropEvent(Squeak.EventDragEnter, evt, canvas, display, eventQueue);
    };
    document.body.ondragleave = function(evt) {
        if (!dragEventHasFiles(evt)) return;
        recordDragDropEvent(Squeak.EventDragLeave, evt, canvas, display, eventQueue);
    };
    document.body.ondrop = function(evt) {
        evt.preventDefault();
        if (!dragEventHasFiles(evt)) return false;
        var files = [].slice.call(evt.dataTransfer.files),
            loaded = [],
            image, imageName = null;
        display.droppedFiles = [];
        files.forEach(function(f) {
            display.droppedFiles.push(f.name);
            var reader = new FileReader();
            reader.onload = function () {
                var buffer = this.result;
                Squeak.filePut(f.name, buffer);
                loaded.push(f.name);
                if (!image && /.*image$/.test(f.name) && (!display.vm || confirm("Run " + f.name + " now?\n(cancel to use as file)"))) {
                    image = buffer;
                    imageName = f.name;
                }
                if (loaded.length == files.length) {                
                    if (image) {
                        SqueakJS.appName = imageName.slice(0, -6);
                        SqueakJS.runImage(image, imageName, display, options);
                    } else {
                        recordDragDropEvent(Squeak.EventDragDrop, evt, canvas, display, eventQueue);
                    }
                }
            };
            reader.readAsArrayBuffer(f);
        });
        return false;
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
        var fullscreen = options.fullscreen || display.fullscreen,
            x = 0,
            y = fullscreen ? 0 : options.header.offsetTop + options.header.offsetHeight,
            w = window.innerWidth,
            h = fullscreen ? window.innerHeight : Math.max(100, options.footer.offsetTop - y),
            paddingX = 0, // padding outside canvas
            paddingY = 0;
        // above are the default values for laying out the canvas
        if (!options.fixedWidth) { // set canvas resolution
            display.width = w;
            display.height = h;
        } else { // fixed resolution and aspect ratio
            display.width = options.fixedWidth;
            display.height = options.fixedHeight;
            var wantRatio = display.width / display.height,
                haveRatio = w / h;
            if (haveRatio > wantRatio) {
                paddingX = w - Math.floor(h * wantRatio);
            } else {
                paddingY = h - Math.floor(w / wantRatio);
            }
        }
        // set size and position
        canvas.style.left = (x + Math.floor(paddingX / 2)) + "px";
        canvas.style.top = (y + Math.floor(paddingY / 2)) + "px";
        canvas.style.width = (w - paddingX) + "px";
        canvas.style.height = (h - paddingY) + "px";
        // set resolution
        if (canvas.width != display.width || canvas.height != display.height) {
            var preserveScreen = options.fixedWidth || !display.resizeTodo, // preserve unless changing fullscreen
                imgData = preserveScreen && display.context.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = display.width;
            canvas.height = display.height;
            if (imgData) display.context.putImageData(imgData, 0, 0);
        }
        // set cursor scale
        if (options.fixedWidth) {
            display.scale = parseInt(canvas.style.width) / canvas.width;
            var cursorCanvas = display.cursorCanvas;
            cursorCanvas.style.width = (cursorCanvas.width * display.scale) + "px";
            cursorCanvas.style.height = (cursorCanvas.height * display.scale) + "px";
        } else {
            display.scale = 1;
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
    var search = window.location.hash.slice(1),
        args = search && search.split("&");
    if (args) for (var i = 0; i < args.length; i++) {
        var keyAndVal = args[i].split("="),
            key = keyAndVal[0],
            val = true;
        if (keyAndVal.length > 1) {
            val = decodeURIComponent(keyAndVal.slice(1).join("="));
            if (val.match(/^(true|false|null|[0-9"[{].*)$/))
                try { val = JSON.parse(val); } catch(e) {
                    if (val[0] === "[") val = val.slice(1,-1).split(","); // handle string arrays
                    // if not JSON use string itself
                };
        }
        options[key] = val;
    }
    var root = Squeak.splitFilePath(options.root || "/").fullname;
    Squeak.dirCreate(root, true);
    if (!/\/$/.test(root)) root += "/";
    options.root = root;
    if (options.url && options.files && !options.image)
        options.image = options.url + "/" + options.files[0];
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
    if (options.image) imageUrl = options.image;
    else options.image = imageUrl;
    SqueakJS.options = options;
    SqueakJS.appName = options.appName || imageUrl.replace(/.*\//, "").replace(/\.image$/, "");
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
        files.push({url: options.document, name: docName, forceDownload: true});
        display.documentName = options.root + docName;
    }
    function getNextFile(whenAllDone) {
        if (files.length === 0) return whenAllDone(imageData);
        var file = files.shift(),
            forceDownload = options.forceDownload || file.forceDownload;
        if (!forceDownload && Squeak.fileExists(options.root + file.name)) {
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
    display.vm = null;
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
        // use original appName from options
        var appName = window.SqueakJS && SqueakJS.options && SqueakJS.options.appName || "SqueakJS";
        if (confirm(appName + ' has been updated. Restart now?')) {
            window.onbeforeunload = null;
            window.location.reload();
        }
    });
}
