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
        parent = module(path.join("."));
    if (!parent[name]) parent[name] = {
        requires: function(ignored) { return this; },
        toRun: function(code) { code(); }
    };
    return parent[name];
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
// display & event setup 
//////////////////////////////////////////////////////////////////////////////

function setupFullscreen(display, canvas, options) {
    if (options.fullscreen) return function alwaysFullscreen(){}; 
    // Fullscreen can only be enabled in an event handler. So we check the
    // fullscreen flag on every mouse down/up and keyboard event.        

    // If the user canceled fullscreen, turn off the fullscreen flag so
    // we don't try to enable it again in the next event
    function fullscreenChange(fullscreenElement) {
        display.fullscreen = canvas == fullscreenElement;
    };

    // Fullscreen support is very browser-dependent
    if (canvas.requestFullscreen) {
        document.addEventListener("fullscreenchange", function(){fullscreenChange(document.fullscreenElement)});
        return function checkFullscreen() {
            if (document.fullscreenEnabled && (canvas == document.fullscreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.requestFullscreen();
                else document.exitFullscreen();
            }
        }
    } else if (canvas.webkitRequestFullscreen) {
        document.addEventListener("webkitfullscreenchange", function(){fullscreenChange(document.webkitFullscreenElement)});
        return function checkFullscreen() {
            if (document.webkitFullscreenEnabled && (canvas == document.webkitFullscreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.webkitRequestFullscreen();
                else document.webkitExitFullscreen();
            }
        }
    } else if (canvas.mozRequestFullScreen) {
        document.addEventListener("mozfullscreenchange", function(){fullscreenChange(document.mozFullScreenElement)});
        return function checkFullscreen() {
            if (document.mozFullScreenEnabled && (canvas == document.mozFullScreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.mozRequestFullScreen();
                else document.mozCancelFullScreen();
            }
        }
    } else if (canvas.msRequestFullscreen) {
        document.addEventListener("MSFullscreenChange", function(){fullscreenChange(document.msFullscreenElement)});
        return function checkFullscreen() {
            if (document.msFullscreenEnabled && (canvas == document.msFullscreenElement) != display.fullscreen) {
                if (display.fullscreen) canvas.msRequestFullscreen();
                else document.msExitFullscreen();
            }
        }
    } else {
        return function checkFullscreen() {}
    }
}

function recordMouseEvent(what, evt, canvas, display, eventQueue, options) {
    var x = (evt.pageX - canvas.offsetLeft) * (canvas.width / canvas.offsetWidth);
        y = (evt.pageY - canvas.offsetTop) * (canvas.height / canvas.offsetHeight);
    // subtract display offset and clamp to display size
    display.mouseX = Math.max(0, Math.min(display.width, x - display.offsetX));
    display.mouseY = Math.max(0, Math.min(display.height, y - display.offsetY));
    var buttons = display.buttons & Squeak.Mouse_All;
    switch (what) {
        case 'move':
            break; // nothing more to do
        case 'up':
            buttons = 0;
            break;
        case 'down':
            switch (evt.button) {
                case 0: buttons = Squeak.Mouse_Red; break;      // left
                case 1: buttons = Squeak.Mouse_Yellow; break;   // middle
                case 2: buttons = Squeak.Mouse_Blue; break;     // right
            }; 
            if (options.swapButtons)
                if (buttons == Squeak.Mouse_Yellow) buttons = Squeak.Mouse_Blue;
                else if (buttons == Squeak.Mouse_Blue) buttons = Squeak.Mouse_Yellow;
            break;
    }
    buttons +=
        (evt.shiftKey ? Squeak.Keyboard_Shift : 0) +
        (evt.ctrlKey ? Squeak.Keyboard_Ctrl : 0) +
        (evt.altKey || evt.metaKey ? Squeak.Keyboard_Cmd : 0);
    display.buttons = buttons;
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
}

function makeSqueakEvent(evt, sqEvtBuf, sqTimeOffset) {
    sqEvtBuf[0] = evt[0];
    sqEvtBuf[1] = (evt[1] - sqTimeOffset) & Squeak.MillisecondClockMask;
    for (var i = 2; i < evt.length; i++)
        sqEvtBuf[i] = evt[i];
}

function createSqueakDisplay(canvas, options) {
    options = options || {};
    var eventQueue = null;
    var display = {
        context: canvas.getContext("2d"),
        fullscreen: false,
        offsetX: 0,
        offsetY: 0,
        width: -1,
        height: -1,
        mouseX: 0,
        mouseY: 0,
        buttons: 0,
        keys: [],
        clipboardString: '',
        clipboardStringChanged: false,
        signalInputEvent: null, // function set by VM
        getNextEvent: function firstTime(firstEvtBuf, firstOffset) {
            eventQueue = [];
            display.getNextEvent = function getNextEvent(evtBuf, timeOffset) {
                var evt = eventQueue.shift();
                if (evt) makeSqueakEvent(evt, evtBuf, timeOffset);
                else evtBuf[0] = Squeak.EventTypeNone;
            };
            display.getNextEvent(firstEvtBuf, firstOffset);
        },
    };
    var checkFullscreen = setupFullscreen(display, canvas, options);
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
        canvas.focus();
        recordMouseEvent('down', evt, canvas, display, eventQueue, options);
        display.vm.interpret(100);
        evt.preventDefault();
        return false;
    };
    canvas.onmouseup = function(evt) {
        recordMouseEvent('up', evt, canvas, display, eventQueue, options);
        display.vm.interpret(100); 
        checkFullscreen();
        evt.preventDefault();
    };
    canvas.onmousemove = function(evt) {
        recordMouseEvent('move', evt, canvas, display, eventQueue, options);
        evt.preventDefault();
    };
    canvas.oncontextmenu = function() {
        return false;
    };
    canvas.ontouchstart = function(evt) {
        canvas.focus();
        canvas.ontouchmove(evt);
    };
    canvas.ontouchmove = function(evt) {
        canvas.onmousemove(evt.touches[0]);
    };
    canvas.ontouchend = function(evt) {
        canvas.ontouchmove(evt);
    };
    canvas.ontouchcancel = function(evt) {
    };
    canvas.onkeypress = function(evt) {
        recordKeyboardEvent(evt.charCode, evt.timeStamp, display, eventQueue);
        evt.preventDefault();
    };
    canvas.onkeydown = function(evt) {
        checkFullscreen();
        var code = ({46:127, 8:8, 45:5, 9:9, 13:13, 27:27, 36:1, 35:4,
            33:11, 34:12, 37:28, 39:29, 38:30, 40:31})[evt.keyCode];
        if (code) { // special key pressed
            recordKeyboardEvent(code, evt.timeStamp, display, eventQueue);
            return evt.preventDefault();
        }
        var modifier = ({16:8, 17:16, 91:64, 18:64})[evt.keyCode];
        if (modifier) { // modifier pressed
            display.buttons |= modifier;
            if (modifier > 8) // special
                display.keys = []; // flush queued key presses
            return evt.preventDefault();
        }
        if ((evt.metaKey || evt.altKey) && evt.which) {
            code = evt.which;
            if (code >= 65 && code <= 90) if (!evt.shiftKey) code += 32;
            else if (evt.keyIdentifier && evt.keyIdentifier.slice(0,2) == 'U+')
                code = parseInt(evt.keyIdentifier.slice(2), 16);
            recordKeyboardEvent(code, evt.timeStamp, display, eventQueue);
            return evt.preventDefault();
        }
    };
    canvas.onkeyup = function(evt) {
        var modifier = ({16:8, 17:16, 91:64, 18:64})[evt.keyCode];
        if (modifier) { display.buttons &= ~modifier; return evt.preventDefault(); }
    };
    window.onresize = function() {
        // if no fancy layout, just assign extent
        if (!options.header || !options.footer) {
            display.width = canvas.width;
            display.height = canvas.height;
            return;
        }
        // CSS won't let us do what we want so we will layout the canvas ourselves.
        // Also, we need to paper over browser differences in fullscreen mode where
        // Firefox scales the canvas but Webkit does not, which makes a difference
        // if we do not use actual pixels but are scaling a fixed-resolution canvas.
        var fullscreen = display.fullscreen || options.fullscreen;
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
        display.offsetX = Math.floor(innerPadX / 2);
        display.offsetY = Math.floor(innerPadY / 2);
        var canvasWidth = display.width + innerPadX;
            canvasHeight = display.height + innerPadY;
        if (canvas.width != canvasWidth || canvas.height != canvasHeight) {
            var imgData = display.context.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            display.context.putImageData(imgData, 0, 0);
        }
    }
    window.onresize();
    return display;
};

//////////////////////////////////////////////////////////////////////////////
// browser stuff 
//////////////////////////////////////////////////////////////////////////////

if (window.applicationCache) {
    applicationCache.addEventListener('updateready', function() {
        applicationCache.swapCache();
        if (confirm('SqueakJS has been updated. Restart now?')) {
            window.location.reload();
        }
    });
}
