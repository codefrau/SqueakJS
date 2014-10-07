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
    var vmDir = window.SqueakJSDir || "../";
    [   "vm.js",
        "jit.js",
        "plugins/BitBltPlugin.js",
        "plugins/LargeIntegers.js",
        "plugins/MiscPrimitivePlugin.js",
        "plugins/ZipPlugin.js",
        "plugins/SoundGenerationPlugin.js",
        "plugins/Matrix2x3Plugin.js",
        "plugins/FloatArrayPlugin.js",
        "plugins/ScratchPlugin.js",
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
    if (options.fullscreen) return function alwaysFullscreen(){};
    
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
    document.body.addEventListener('dragover', function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
        return false;
    });
    document.body.addEventListener('drop', function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        [].slice.call(evt.dataTransfer.files).forEach(function(f) {
            var reader = new FileReader();
            reader.onload = function () {
                var buffer = this.result;
                if (/.*image$/.test(f.name) && confirm("Run " + f.name + " now?\n(cancel to store as file)")) {
                    SqueakJS.runImage(buffer, f.name, display, options);
                } else {
                    Squeak.filePut(f.name, buffer);
                }
            };
            reader.readAsArrayBuffer(f);
        });
        return false;
    });
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
        if (!options.header || !options.footer) {
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
            spinner.display = "initial";
            spinner.webkitTransform = spinner.transform = "rotate(" + (spinnerAngle += 30) + "deg)";
        }
    }
}

//////////////////////////////////////////////////////////////////////////////
// main loop 
//////////////////////////////////////////////////////////////////////////////

var loop; // holds timeout for main loop

SqueakJS.runImage = function(buffer, name, display, options) {
    SqueakJS.appName = options.appName || "SqueakJS";
    SqueakJS.options = options;
    window.onbeforeunload = function() {
        return SqueakJS.appName + " is still running";
    };
    window.clearTimeout(loop);
    display.reset();
    display.clear();
    display.showBanner("Initializing " + SqueakJS.appName + ", please wait");
    var self = this;
    window.setTimeout(function() {
        var image = new Squeak.Image(buffer, name);
        var vm = new Squeak.Interpreter(image, display);
        SqueakJS.vm = vm;
        localStorage["squeakImageName"] = name;
        setupSwapButtons(options);
        display.clear();
        var spinner = setupSpinner(vm, options);
        function run() {
            try {
                if (display.quitFlag) self.onQuit(vm, display, options);
                else vm.interpret(200, function(ms) {
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
    }, 0);
};

SqueakJS.runSqueak = function(url, canvas, options) {
    var search = window.location.search,
        altImage = search && search.match(/image=(.*\.image)/);
    if (altImage) url = altImage[1];
    var imageName = Squeak.splitFilePath(url).basename,
        display = createSqueakDisplay(canvas, options);
    display.showBanner("Downloading " + imageName);
    var rq = new XMLHttpRequest();
    rq.open('GET', url);
    rq.responseType = 'arraybuffer';
    rq.onprogress = function(e) {
        if (e.lengthComputable) display.showProgress(e.loaded / e.total);
    }
    rq.onload = function(e) {
        if (rq.status == 200)
            SqueakJS.runImage(rq.response, imageName, display, options);
        else rq.onerror(rq.statusText);
    };
    rq.onerror = function(e) {
        alert("Image: " + url + "\nError: " + e);
    }
    rq.send();
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
